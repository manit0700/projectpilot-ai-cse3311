# CSE 3311 Next Submission Recovery Plan

## Main Problem From Inception Feedback

The project idea was understandable, but the presentation did not make the system concrete enough. The next submission needs to show exactly who the system is for, what task types it supports, how the manager agent communicates with sub-agents, how the user gives feedback, how the workflow moves screen by screen, and how the project is different from existing multi-agent development tools.

## Updated Project Direction

ProjectPilot AI should be positioned as an AI project manager for student software projects and small course-sized software builds. The system should not claim to replace a full software team. Its first version should help one user plan, divide, track, review, and revise a small software project using a manager agent and specialized worker agents.

This direction makes the project more specific than general tools like ChatGPT, Codex, ChatDev, MetaGPT, Devika, or CrewAI. The main value is not only generating code. The value is giving students a guided software engineering workflow with task breakdown, human oversight, feedback loops, and visible project coordination.

## What Must Be Added Next

### 1 Timeline

Add a clear semester timeline. Use course iterations instead of vague weeks.

Example:

| Course Period | Iteration Goal | Deliverable |
|---|---|---|
| Iteration 1 | Requirements, target users, competitor research, workflow design | Updated proposal and workflow diagram |
| Iteration 2 | Manager agent planning flow and task breakdown prototype | Task planning demo |
| Iteration 3 | Sub-agent task execution and communication model | Agent communication demo |
| Iteration 4 | User feedback loop and correction workflow | Revision workflow demo |
| Iteration 5 | Integration, testing, UI polish | Working MVP |
| Final | Documentation, presentation, final testing | Final submission |

### 2 Proposal

Add a stronger proposal statement:

ProjectPilot AI is a single-user AI project management and software development assistant for students building small software projects. A manager agent converts a project idea into requirements, tasks, dependencies, and review checkpoints. Specialized agents then help with frontend, backend, testing, documentation, and review while the user keeps control through approval and feedback steps.

### 3 Main Agent Equals Manager Agent

Use one term consistently: manager agent.

Definition:

The manager agent is responsible for understanding the user's project request, breaking it into tasks, assigning tasks to specialized agents, tracking progress, and asking the user for approval before major changes are accepted.

### 4 Human Oversight

Add human checkpoints:

- User approves the initial project summary.
- User approves the task breakdown before agents begin work.
- User can edit requirements at any time.
- User reviews agent outputs before integration.
- User can request corrections or regenerate a task.

### 5 Workflow

Add a screen flow:

1. User enters project idea.
2. System asks clarifying questions.
3. Manager agent creates project summary.
4. Manager agent creates task breakdown and dependencies.
5. User approves or edits the plan.
6. Specialized agents work on assigned tasks.
7. Manager agent combines outputs.
8. Review agent checks consistency and missing parts.
9. User gives feedback.
10. System revises the project plan or outputs.

### 6 Alternatives Considered

Add a comparison against existing approaches:

| Alternative | Limitation | Why ProjectPilot AI Is Different |
|---|---|---|
| ChatGPT or chatbot workflow | User must manually coordinate tasks and remember context | ProjectPilot keeps an explicit project plan and task breakdown |
| Codex or coding assistant | Strong for code but less focused on project management workflow | ProjectPilot focuses on planning, dependencies, and review checkpoints |
| ChatDev | Multi-agent development exists but may be too broad or research-like for students | ProjectPilot targets student course projects and visible human approval |
| MetaGPT | Structured multi-agent framework but complex for beginners | ProjectPilot provides a simpler UI and guided workflow |
| Devika | Autonomous dev agent, but may not emphasize classroom-style process and review | ProjectPilot emphasizes oversight, learning, and correction |
| CrewAI | Framework for building agent teams, not a student-facing project workflow by itself | ProjectPilot is an end-user application built around software project tasks |

### 7 Goals

Add clear goals:

- Help one user turn a software idea into a structured project plan.
- Break work into frontend, backend, database, testing, documentation, and review tasks.
- Show the manager agent's reasoning in a readable way.
- Let the user approve, reject, or revise the task plan.
- Support a small MVP software project from planning through review.

### 8 Non Goals

Add clear non-goals:

- Do not build a brand-new AI model.
- Do not replace professional developers.
- Do not support large enterprise software projects in the first version.
- Do not support multiplayer/team collaboration in the first version.
- Do not support every software domain.
- Do not fully automate deployment or production security review.

### 9 UI Prototype

The next presentation must show the prototype longer and explain each screen.

Minimum screens:

- Project idea input screen
- Clarifying questions screen
- Manager task breakdown screen
- Agent assignment board
- Agent communication/status view
- Output review screen
- User feedback/revision screen

### 10 Open Questions

Add open questions and show how the team will answer them:

- Which specific task types should the MVP support first?
- Which AI API should be used first?
- How much of the manager agent's reasoning should the user see?
- How do we measure if an output is useful?
- What should happen when two agents produce conflicting output?
- How many correction loops should the MVP support?

### 11 Q and A Fixes

Prepare answers for likely questions:

Question: How do agents communicate?

Answer: The manager agent creates a shared project plan. Each specialized agent receives a task, expected output format, dependencies, and context. The manager collects outputs, checks whether dependencies are satisfied, and sends unclear or conflicting work to a review step.

Question: How does the user correct the system?

Answer: The user can edit the project summary, task list, or individual agent output. The manager agent then updates dependent tasks and asks affected agents to revise their work.

Question: How does the project compare to ChatDev, MetaGPT, Devika, and CrewAI?

Answer: Those tools show that multi-agent development is possible, but our project focuses on a student-friendly single-user workflow with human approval, visible task breakdown, and course-sized software projects.

Question: Who is the first user group?

Answer: The first user group is students building small software projects for classes, hackathons, or portfolios.

Question: What tasks are targeted first?

Answer: The first version targets project planning, requirements summary, task breakdown, frontend/backend task assignment, testing checklist generation, documentation, and review.

## Risk Analysis To Add

| Risk | Priority | Effect If It Happens | Mitigation |
|---|---|---|---|
| Manager agent divides project incorrectly | High | Bad task dependencies and rework | Require user approval of task plan and dependency check |
| Agents produce inconsistent outputs | High | Integration problems | Use shared project context and a review agent |
| User requirements are unclear | High | Wrong plan or wrong output | Ask clarifying questions before task generation |
| Project scope becomes too broad | Medium | Team cannot finish MVP | Focus on student projects and a limited task set |
| Existing competitors look stronger | Medium | Project seems unoriginal | Emphasize student workflow, oversight, and course-sized use case |
| AI API integration is harder than expected | Medium | Prototype delays | Start with one API and mock outputs if needed |
| UI workflow is confusing | Medium | Users cannot understand the system | Build screen flow and test it with classmates |

## Grade Recovery Priorities

1. Make target user and target task type specific.
2. Add competitor comparison with ChatDev, MetaGPT, Devika, CrewAI, ChatGPT, and Codex.
3. Add risk analysis.
4. Add clear workflow and screen flow.
5. Add user feedback loop.
6. Explain agent communication.
7. Show the prototype longer and walk through it slowly.
8. Use consistent term: manager agent.

