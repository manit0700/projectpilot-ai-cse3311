# Team 6 Review Action Items For Team 5

Source file: `/Users/manitdankhara/Downloads/Team 6 - Inception Review of Team 5.xlsx`

## Highest Priority Fixes

### 1 Define MVP Task Types

Team 6 finding: The task types supported by the MVP have not been selected.

Action:

For Iteration 1, define the MVP task types as:

- Requirements summary
- Clarifying questions
- Task breakdown
- Task dependency ordering
- Frontend task planning
- Backend task planning
- Testing checklist
- Documentation outline
- Review and correction workflow

Do not claim support for every software task type yet.

### 2 Define Agent Scheduling And Dependencies

Team 6 finding: Task dependencies and scheduling behavior between agents are not defined.

Action:

Add a workflow diagram showing:

1. Manager agent receives user goal.
2. Manager agent creates tasks.
3. Manager agent assigns dependencies.
4. Tasks with no blockers start first.
5. Blocked tasks wait for prerequisite outputs.
6. Review agent checks outputs.
7. User approves or requests changes.

### 3 Define Agent Failure Handling

Team 6 finding: Failure handling for unavailable agents, timeouts, or invalid outputs is not specified.

Action:

Add these rules:

- If an agent times out, the manager retries once.
- If output is invalid, the review agent flags it.
- If retry fails, the manager asks the user whether to skip, retry, or manually edit.
- Failed tasks remain visible in the task board.

### 4 Select AI APIs For First Version

Team 6 finding: The specific AI models or APIs for the first version have not been selected.

Action:

Use this first-version decision:

- Primary API: OpenAI API for manager and specialized agents
- Optional research comparison: Hugging Face models for future exploration
- Prototype fallback: mocked agent responses if API integration is delayed

### 5 Define Output Evaluation

Team 6 finding: There is no defined method for evaluating whether an agent output is useful or correct.

Action:

Add evaluation criteria:

- Does the output match the user's approved requirement?
- Does it satisfy the assigned task?
- Does it conflict with another task?
- Is it complete enough for the next step?
- Did the user accept it, edit it, or reject it?

### 6 Add Risk Exposure

Team 6 finding: Risk section is missing and should show risk exposure.

Action:

Add risk exposure table:

| Risk | Probability | Effect E | Risk Exposure RE |
|---|---:|---:|---:|
| Manager agent creates wrong task breakdown | 40% | 20 hours | 8.0 hours |
| Agent outputs do not integrate | 35% | 18 hours | 6.3 hours |
| User requirements are unclear | 30% | 14 hours | 4.2 hours |
| AI API integration is delayed | 25% | 16 hours | 4.0 hours |
| Scope is too broad for semester | 30% | 15 hours | 4.5 hours |

Formula: `RE = probability * effect`.

### 7 Add Competitor Breakdown

Team 6 finding: Competitors are mentioned but not broken down.

Action:

Add competitor table:

| Competitor | Strength | Limitation | Our Difference |
|---|---|---|---|
| ChatGPT | General assistant | User manually coordinates project | ProjectPilot stores plan and task flow |
| Codex | Strong coding assistant | Less focused on project management | ProjectPilot focuses on student workflow |
| ChatDev | Multi-agent software simulation | Broad and less classroom focused | ProjectPilot targets student projects |
| MetaGPT | Structured multi-agent framework | Complex for beginners | ProjectPilot has simpler UI |
| Devika | Autonomous coding agent | Less emphasis on human checkpoints | ProjectPilot keeps user approval |
| CrewAI | Agent framework | Not an end-user app by itself | ProjectPilot is a student-facing workflow |

### 8 Define Target Users

Team 6 finding: Targeted user base is absent.

Action:

Use this definition:

The first target user group is students building small course, hackathon, or portfolio software projects. The first version is single-user and focuses on helping one student plan, divide, review, and revise a project.

### 9 Add Core Use Cases

Team 6 finding: Core use cases and outcomes are not documented.

Action:

Add these use cases:

- UC1: User creates a project idea.
- UC2: System asks clarifying questions.
- UC3: Manager agent creates requirements summary.
- UC4: Manager agent creates task breakdown.
- UC5: User approves or edits task plan.
- UC6: Specialized agents produce task outputs.
- UC7: Review agent checks consistency.
- UC8: User gives feedback and system revises.

### 10 Assign Team Roles

Team 6 finding: Roles are not specifically assigned to each team member.

Action:

Add a team role table. Fill names based on the team decision.

| Role | Responsibility | Owner |
|---|---|---|
| Project manager workflow | Manager agent logic, task flow | TBD |
| UI prototype | Screens and screen transitions | TBD |
| Backend/API | Agent API calls and data handling | TBD |
| Research and competitors | Competitor comparison and citations | TBD |
| Testing and documentation | Evaluation, risks, write-up | TBD |

### 11 Add User Feedback Evidence

Team 6 finding: User feedback is not documented to justify decisions.

Action:

Collect quick feedback from 3 to 5 students:

- Would this task breakdown help with a class project?
- Which screen is confusing?
- Which task types are most useful?
- Would you want to approve tasks before agents start?
- What would make the output trustworthy?

Then include the findings in the next presentation.

## Slide Updates Required

Add or revise these slides:

1. Project vision
2. Target user
3. MVP task types
4. Core use cases
5. Agent workflow and scheduling
6. Agent interface and shared context
7. Human approval checkpoints
8. Failure handling
9. Competitor comparison
10. Risk exposure
11. Team roles
12. User feedback plan/results
13. Iteration-based timeline

