from pydantic import BaseModel


class RoutingRuleOut(BaseModel):
    task_type: str
    model_chain: list[str]
    is_default: bool  # true if this is the built-in default, not something the user saved
