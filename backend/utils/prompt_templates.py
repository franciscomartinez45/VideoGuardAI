"""
Prompt templates for LLM-based anomaly report analysis.
Provides structured prompts for video forensics analysis using Ollama.
"""

SYSTEM_PROMPT = """You are an expert video forensics analyst specializing in detecting video manipulation and deepfakes. You analyze anomaly detection reports from an AI-powered video analysis system.

Your task is to:
1. Interpret technical anomaly data and explain it in clear language
2. Assess video authenticity based on anomaly patterns
3. Provide actionable insights for investigators
4. Consider context: some anomalies may be natural (compression, lighting) vs. suspicious (editing, manipulation)

Anomaly Types Context:
- Disappearance Events: Objects appearing/disappearing (could be occlusion OR frame deletion)
- Speed Anomalies: Unnatural acceleration/deceleration (could be playback speed manipulation)
- Jittery Motion: Erratic movement (could be poor tracking OR frame interpolation artifacts)
- Teleporting: Sudden position jumps (strong indicator of frame splicing or object insertion)

You MUST respond with valid JSON only, using this exact structure:
{
  "summary": "2-3 sentence natural language summary of findings",
  "authenticity_assessment": {
    "confidence_score": 0.0-1.0,
    "verdict": "likely_authentic" OR "suspicious" OR "likely_manipulated",
    "reasoning": "Detailed explanation of the verdict"
  },
  "detailed_insights": [
    "Key observation 1",
    "Key observation 2",
    "Key observation 3 (continue as needed)"
  ],
  "risk_factors": [
    {
      "factor": "Description of risk factor",
      "severity": "low" OR "medium" OR "high",
      "impact": "Explanation of what this means"
    }
  ]
}

Do not include any text outside the JSON structure. Ensure the JSON is valid and complete."""

USER_PROMPT_TEMPLATE = """Analyze this video anomaly detection report:

OVERVIEW:
- Total anomalies detected: {total_anomalies}
- Objects tracked: {total_objects}
- Objects with issues: {objects_with_issues}
- Clean objects: {clean_objects}

ANOMALY BREAKDOWN:
{anomaly_breakdown}

MOST PROBLEMATIC OBJECTS:
{problematic_objects}

Provide your analysis in the JSON format specified in the system prompt."""


def format_anomaly_breakdown(breakdown):
    """Format anomaly breakdown array into readable text."""
    lines = []
    for item in breakdown:
        lines.append(f"\n{item['type']}:")
        lines.append(f"  Count: {item['count']}")
        lines.append(f"  Severity: {item['severity']}")
        lines.append(f"  Description: {item['description']}")
        if item['examples']:
            lines.append(f"  Examples:")
            for example in item['examples']:
                lines.append(f"    - {example}")
    return '\n'.join(lines)


def format_problematic_objects(objects):
    """Format problematic objects array into readable text."""
    if not objects:
        return "None"

    lines = []
    for obj in objects:
        issues_str = ', '.join(obj['issues'])
        lines.append(
            f"  - Track {obj['track_id']} ({obj['object']}): "
            f"Issues: [{issues_str}], Max Score: {obj['max_score']}"
        )
    return '\n'.join(lines)


def generate_prompt(report_data):
    """
    Generate a complete prompt for LLM analysis from a report.

    Args:
        report_data: Dictionary containing the anomaly report

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    summary = report_data.get('user_friendly_summary', {})
    overview = summary.get('overview', {})
    breakdown = summary.get('anomaly_breakdown', [])
    problematic = summary.get('most_problematic_objects', [])

    user_prompt = USER_PROMPT_TEMPLATE.format(
        total_anomalies=overview.get('total_anomalies_detected', 0),
        total_objects=overview.get('total_objects_tracked', 0),
        objects_with_issues=overview.get('objects_with_issues', 0),
        clean_objects=overview.get('clean_objects', 0),
        anomaly_breakdown=format_anomaly_breakdown(breakdown),
        problematic_objects=format_problematic_objects(problematic)
    )

    return SYSTEM_PROMPT, user_prompt
