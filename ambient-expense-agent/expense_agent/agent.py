# ruff: noqa
import base64
import json
import os
import re
from pydantic import BaseModel, Field
from typing import Any, List, Optional
from google.genai import types

from google.adk.agents import LlmAgent
from google.adk.apps import App, ResumabilityConfig
from google.adk.models import Gemini
from google.adk.workflow import Workflow, START, node
from google.adk.events.event import Event
from google.adk.events.request_input import RequestInput
from google.adk.agents.context import Context

from . import config

# Setup Credentials dynamically between Google AI Studio (GEMINI_API_KEY) and Vertex AI
if os.environ.get("GEMINI_API_KEY"):
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"
else:
    try:
        import google.auth
        _, project_id = google.auth.default()
        os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
        os.environ["GOOGLE_CLOUD_LOCATION"] = "global"
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    except Exception:
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"


# ====================================================================
# 1. Define Schemas
# ====================================================================

class ExpenseReport(BaseModel):
    amount: float = Field(description="The expense amount in USD")
    submitter: str = Field(description="The name of the person submitting the expense")
    category: str = Field(description="The category of the expense (e.g. Travel, Meals, Office)")
    description: str = Field(description="Description of what was purchased")
    date: str = Field(description="The date of the expense")


class RiskAssessment(BaseModel):
    risk_score: int = Field(description="Risk score from 1 (lowest) to 10 (highest)")
    risk_factors: List[str] = Field(description="List of risk factors, policy violations, or anomalies detected")
    alert_raised: bool = Field(description="Whether a high risk alert is raised")
    reasoning: str = Field(description="Detailed explanation of the risk assessment")


# ====================================================================
# Security Helper Functions
# ====================================================================

def scrub_pii(text: str) -> tuple[str, List[str]]:
    """Scrubs SSNs and Credit Card numbers from the text using regex."""
    redacted = []
    
    # Match SSN: XXX-XX-XXXX
    ssn_pattern = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
    if ssn_pattern.search(text):
        text = ssn_pattern.sub('[REDACTED_SSN]', text)
        redacted.append("SSN")
        
    # Match Credit Card numbers (both formatted and unformatted 13-16 digits)
    cc_pattern = re.compile(r'\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{13,16}\b')
    if cc_pattern.search(text):
        text = cc_pattern.sub('[REDACTED_CC]', text)
        redacted.append("Credit Card")
        
    return text, redacted


def detect_prompt_injection(text: str) -> bool:
    """Scans the text for common prompt injection/override phrases."""
    injection_keywords = [
        "ignore previous",
        "system instruction",
        "auto-approve",
        "auto approve",
        "bypass rules",
        "override rules",
        "new rule",
        "change rule",
        "you must approve",
        "ignore rules",
        "ignore the threshold"
    ]
    text_lower = text.lower()
    for kw in injection_keywords:
        if kw in text_lower:
            return True
    return False


def get_human_decision(ctx: Context) -> Optional[str]:
    """Helper to retrieve human approval decisions from resume inputs or text events."""
    # 1. Check structured resume inputs first (ideal for Web UI/Playground)
    if ctx.resume_inputs and "human_decision" in ctx.resume_inputs:
        return ctx.resume_inputs["human_decision"]
        
    # 2. Fallback to scanning events in reverse for CLI text-based resumption
    for event in reversed(ctx.session.events):
        if event.author == "user" and event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    text_val = part.text.strip().lower()
                    if text_val in ["approve", "approved", "reject", "rejected"]:
                        return text_val
    return None


# ====================================================================
# 2. Define Workflow Nodes
# ====================================================================

def parse_event(ctx: Context, node_input: Any) -> Event:
    """Parses JSON input events, handling base64 Pub/Sub or plain payloads."""
    # If the expense is already in state, we are resuming/rerunning. Preserve it.
    if "expense" in ctx.state:
        return Event(output=ctx.state["expense"])

    raw_payload = {}
    
    # Extract the payload based on incoming types
    if isinstance(node_input, types.Content):
        if node_input.parts:
            try:
                raw_payload = json.loads(node_input.parts[0].text)
            except Exception:
                raw_payload = {"description": node_input.parts[0].text}
    elif isinstance(node_input, str):
        try:
            raw_payload = json.loads(node_input)
        except Exception:
            raw_payload = {"description": node_input}
    elif isinstance(node_input, dict):
        raw_payload = node_input
        
    # Standardize data extraction (Pub/Sub puts it under message.data or data)
    data = None
    if "data" in raw_payload:
        data = raw_payload["data"]
    elif "message" in raw_payload and isinstance(raw_payload["message"], dict):
        data = raw_payload["message"].get("data")
        
    expense_details = {}
    if data:
        if isinstance(data, str):
            # Attempt base64 decoding (standard for Pub/Sub)
            try:
                decoded = base64.b64decode(data).decode("utf-8")
                expense_details = json.loads(decoded)
            except Exception:
                # Fallback to plain JSON string parsing
                try:
                    expense_details = json.loads(data)
                except Exception:
                    expense_details = {"description": data}
        elif isinstance(data, dict):
            expense_details = data

    # Extracted values with fallbacks
    expense = {
        "amount": float(expense_details.get("amount", 0.0)),
        "submitter": str(expense_details.get("submitter", "Unknown")),
        "category": str(expense_details.get("category", "General")),
        "description": str(expense_details.get("description", "No description")),
        "date": str(expense_details.get("date", "Unknown"))
    }
    
    return Event(output=expense, state={"expense": expense})


def check_threshold(ctx: Context, node_input: dict) -> Event:
    """Checks the expense against the threshold config and routes accordingly."""
    expense = node_input
    amount = expense.get("amount", 0.0)
    
    msg = f"Auditing expense of ${amount:.2f} against config threshold ${config.EXPENSE_THRESHOLD:.2f}"
    
    if amount < config.EXPENSE_THRESHOLD:
        route = "auto_approve"
        content_msg = f"✅ {msg} -> Under threshold. Routing to Auto-Approve."
    else:
        route = "require_review"
        content_msg = f"🔍 {msg} -> Over threshold. Routing to Security Screen."
        
    return Event(
        output=expense,
        route=route,
        content=types.Content(role="model", parts=[types.Part.from_text(text=content_msg)])
    )


def auto_approve(ctx: Context, node_input: dict) -> Event:
    """Auto-approves expenses that are below the dollar threshold."""
    expense = node_input
    outcome = {
        "status": "approved",
        "reason": f"Expense amount ${expense.get('amount'):.2f} is below the threshold of ${config.EXPENSE_THRESHOLD:.2f}.",
        "method": "auto",
        "expense": expense,
        "risk_assessment": None
    }
    return Event(
        output=outcome,
        content=types.Content(role="model", parts=[types.Part.from_text(text="🎉 Auto-Approved instantly!")])
    )


def security_screen(ctx: Context, node_input: dict) -> Event:
    """Scrubs sensitive PII data and checks for prompt injection attempts."""
    expense = node_input
    desc = expense.get("description", "")
    
    # 1. PII Redaction
    cleaned_desc, redacted_categories = scrub_pii(desc)
    
    # Copy and update details
    cleaned_expense = dict(expense)
    cleaned_expense["description"] = cleaned_desc
    
    if redacted_categories:
        existing_redacted = ctx.state.get("redacted_pii", [])
        updated_redacted = list(set(existing_redacted + redacted_categories))
        ctx.state["redacted_pii"] = updated_redacted
        cleaned_expense["redacted_pii"] = updated_redacted
        
    ctx.state["expense"] = cleaned_expense
    
    # 2. Prompt Injection Defense
    if detect_prompt_injection(desc):
        ctx.state["prompt_injection_detected"] = True
        
        # Build mock RiskAssessment bypass report
        mock_risk = {
            "risk_score": 10,
            "risk_factors": ["Security Event: Potential prompt injection attempt blocked!"],
            "alert_raised": True,
            "reasoning": f"Prompt injection keywords detected in description: '{desc}'"
        }
        
        content_msg = "🚨 SECURITY CHECKPOINT: Prompt injection attempt detected! Bypassing LLM review and routing directly to human review."
        
        return Event(
            output=mock_risk,
            route="bypass_llm",
            content=types.Content(role="model", parts=[types.Part.from_text(text=content_msg)])
        )
        
    # Clean Flow
    content_msg = "🛡️ SECURITY CHECKPOINT: Description is clean. Routing to LLM Review."
    if redacted_categories:
        content_msg = f"🛡️ SECURITY CHECKPOINT: Sensitive data scrubbed ({', '.join(redacted_categories)}). Routing to LLM Review."
        
    return Event(
        output=cleaned_expense,
        route="clean",
        content=types.Content(role="model", parts=[types.Part.from_text(text=content_msg)])
    )


# LLM Node that evaluates high-value expenses
review_agent = LlmAgent(
    name="review_agent",
    model=Gemini(
        model=config.MODEL_NAME,
        retry_options=types.HttpRetryOptions(attempts=3),
    ),
    instruction=(
        "You are an expense report risk auditor. Review the provided expense details "
        "and determine if there are any risks, policy violations, or anomalies. "
        "Provide a structured assessment including a risk score from 1 to 10, a list "
        "of risk factors, and specify whether an alert is raised."
    ),
    output_schema=RiskAssessment,
    mode="single_turn",
)


@node(rerun_on_resume=True)
async def pause_for_human(ctx: Context, node_input: dict):
    """Pauses the workflow to wait for a human to review the risk and decide."""
    risk_assessment = node_input
    ctx.state["risk_assessment"] = risk_assessment
    
    decision = get_human_decision(ctx)
    
    # If the workflow is not yet resumed with input, raise the HITL interrupt
    if not decision:
        msg = (
            f"⚠️ Expense requires human review!\n"
            f"Risk Score: {risk_assessment.get('risk_score')}/10\n"
            f"Alert Raised: {risk_assessment.get('alert_raised')}\n"
            f"Risk Factors: {risk_assessment.get('risk_factors')}\n"
            f"Reasoning: {risk_assessment.get('reasoning')}\n\n"
            f"Please enter 'approve' or 'reject':"
        )
        yield RequestInput(interrupt_id="human_decision", message=msg)
        return
        
    yield Event(output={
        "risk_assessment": risk_assessment,
        "decision": decision
    })


def record_outcome(ctx: Context, node_input: dict):
    """Unified logger that registers and prints the final approval decision."""
    expense = ctx.state.get("expense", {})
    redacted = ctx.state.get("redacted_pii", [])
    injection = ctx.state.get("prompt_injection_detected", False)
    
    # Identify if outcome is from human decision or auto-approval
    if "decision" in node_input:
        decision_val = str(node_input["decision"]).strip().lower()
        status = "approved" if "approve" in decision_val else "rejected"
        outcome = {
            "status": status,
            "reason": f"Human reviewer decision: {node_input['decision']}",
            "method": "human",
            "expense": expense,
            "risk_assessment": node_input["risk_assessment"]
        }
    else:
        outcome = node_input

    msg_lines = [
        "📝 Expense Processed:",
        f"  - Submitter: {expense.get('submitter')}",
        f"  - Amount: ${expense.get('amount'):.2f}",
        f"  - Status: {outcome['status'].upper()}",
        f"  - Method: {outcome['method'].upper()}",
    ]
    
    if redacted:
        msg_lines.append(f"  - 🛡️ PII Redacted: {', '.join(redacted)}")
    if injection:
        msg_lines.append("  - 🚨 Security Alert: Prompt injection attempt was blocked!")
        
    msg_lines.append(f"  - Reason: {outcome['reason']}")
    msg = "\n".join(msg_lines)
    
    yield Event(content=types.Content(role="model", parts=[types.Part.from_text(text=msg)]))
    yield Event(output=outcome)


# ====================================================================
# 3. Assemble Workflow Graph & Application
# ====================================================================

root_agent = Workflow(
    name="expense_agent",
    edges=[
        ('START', parse_event),
        (parse_event, check_threshold),
        (check_threshold, {"auto_approve": auto_approve, "require_review": security_screen}),
        (security_screen, {"bypass_llm": pause_for_human, "clean": review_agent}),
        (review_agent, pause_for_human),
        (pause_for_human, record_outcome),
        (auto_approve, record_outcome),
    ],
    rerun_on_resume=True,  # Let the graph re-evaluate, our nodes handle state preservation safely
)

app = App(
    root_agent=root_agent,
    name="expense_agent",
    resumability_config=ResumabilityConfig(is_resumable=True),
)
