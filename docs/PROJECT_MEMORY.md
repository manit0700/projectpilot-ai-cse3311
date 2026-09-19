# ProjectPilot AI Project Memory

## Course

CSE 3311 Object-Oriented Software Engineering

## Project Name

ProjectPilot AI

## Current Direction

ProjectPilot AI is a student-focused, single-user AI project manager for small software projects. The first target users are students building class projects, hackathon apps, or portfolio projects.

The system helps a user turn a project idea into a clear development plan. It uses a manager agent to ask clarifying questions, create requirements, break the project into tasks, assign work to specialized agents, track dependencies, review outputs, and support user feedback.

## Why We Narrowed The Scope

Previous feedback said the original idea was too broad and did not clearly explain the target user, workflow, competitors, risks, agent communication, or feedback loop. The project is now scoped around one student using the system for one small software project.

## Target User

Students building small software projects, including:

- class projects
- hackathon projects
- portfolio projects

## MVP Features

- Project idea input
- Clarifying questions
- Requirements summary
- Task breakdown
- Dependency ordering
- Agent assignment board
- Human approval checkpoints
- Review output page
- Feedback and revision loop
- Final project plan screen

## Agents

- Manager Agent: coordinates requirements, tasks, dependencies, approvals, and revisions
- Frontend Agent: handles UI screens and components
- Backend Agent: handles API and server-side planning
- Database Agent: handles data model and storage planning
- Testing Agent: creates test checklist and acceptance criteria
- Documentation Agent: creates README and project documentation
- Review Agent: checks conflicts, missing pieces, and consistency

## Workflow

1. User enters a project idea.
2. Manager Agent asks clarifying questions.
3. Manager Agent creates requirements.
4. User approves or rejects requirements.
5. Manager Agent creates a task breakdown with dependencies.
6. User approves or edits the task plan.
7. Specialized agents work on assigned tasks.
8. Review Agent checks outputs for missing pieces and conflicts.
9. User gives feedback.
10. Manager Agent updates affected tasks.
11. System produces a final project plan and evaluation metrics.

## Agent Communication Contract

Each agent receives:

- task id
- task description
- dependencies
- expected output
- constraints
- shared project context

Each agent returns:

- output summary
- assumptions
- blockers
- confidence
- next steps

## Data Model

- Project
- Requirement
- Task
- Agent
- AgentOutput
- Review
- Feedback

## Main Risks

| Risk | Mitigation |
|---|---|
| Manager agent creates wrong task breakdown | Human approval before agents start |
| Agent outputs conflict | Shared context and Review Agent conflict check |
| User requirements are unclear | Clarifying questions before requirements |
| AI API integration is delayed | Mock responses for prototype |
| Scope becomes too broad | Keep MVP focused on student projects |

## Competitors And Alternatives

- ChatGPT
- Codex
- ChatDev
- MetaGPT
- Devika
- CrewAI

ProjectPilot AI is different because it focuses on student projects, human approval, visible task breakdown, feedback loops, and a simple single-user workflow.

## Current Deliverables

- Iteration 1 presentation deck
- MVP prototype app
- Project memory and recovery notes
- Team 6 review action items

