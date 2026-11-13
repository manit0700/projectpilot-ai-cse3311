# ProjectPilot AI Demo Script

## Short Demo Description

This demo shows how ProjectPilot AI turns one rough software idea into an organized project plan. The user starts by entering a project idea or selecting the guided demo. The Manager Agent then creates clarifying questions, turns the answers into requirements, divides the work into dependency-ordered tasks, assigns those tasks to specialist agents, and sends the outputs through a review step. The important part is that the system does not move forward automatically without the user. Human approval is required before requirements become tasks and before agents run.

## What To Say Before The Demo

For Iteration 1, our goal is to prove the core workflow of our project. ProjectPilot AI is not just a chatbot. It acts like a project manager that coordinates multiple specialized agents. In this demo, we use mock AI responses so the presentation is reliable. The current MVP is a planning prototype and does not call real AI APIs.

## Live Demo Steps

1. Open the app at `http://localhost:3000`.
2. On the New Project screen, click `Run guided demo`.
3. Explain that the guided demo creates a sample student software project.
4. Show the generated requirements.
5. Approve the requirements one by one.
6. Click `Approve requirements -> build tasks`.
7. Show the task plan (table on desktop, cards on smaller screens).
8. Point out that the Manager Agent assigned tasks to different agents:
   - Database Agent
   - Backend Agent
   - Frontend Agent
   - Testing Agent
   - Documentation Agent
9. Click `Approve plan & run agents`.
10. Wait for the agents to finish.
11. Show the agent outputs and review results.
12. Explain that the Review Agent checks for missing items, conflicts, and next steps.
13. Approve individual outputs, leaving one output for revision.
14. Click `Request revision` on that output, then `Continue to feedback`.
15. Show the selected task and assigned agent. Enter feedback and click `Apply feedback`.
16. The app returns to Review. Point out that the revised output is pending while unaffected approvals remain approved.
17. Approve the revised output, click `Continue to feedback`, then `Skip revisions & finalize approved plan`.
18. Show the final plan and `Download Markdown`. Planning time saved is a demo estimate, not measured productivity.
19. Revisit an earlier step using the stepper to demonstrate that viewing preserves existing work. Avoid refreshing: this MVP stores the current session in memory.

## What To Say During The Task Breakdown

Here the Manager Agent breaks the project into smaller tasks. The tasks are ordered by dependency, so database and API planning happen before UI wiring and testing. This is one of the main project goals: reducing manual coordination work for students building software projects.

## What To Say During Agent Output

Each specialist agent receives the project context, the assigned task, the dependencies, the expected output, and the constraints. The agents then return structured outputs that the Manager Agent can review and combine.

## What To Say At The End

This demonstrates the MVP workflow: project idea, requirements, task planning, mock agent assignment, individual output review, and human feedback. Revisions require approval again before finalization. The final plan can be downloaded as Markdown; this demo does not modify repositories, run real AI, or deploy applications.

## Step-By-Step Demo Video Recording Plan

1. Start screen recording.
2. Open the browser to `http://localhost:3000`.
3. Pause on the New Project screen for 2 seconds.
4. Say: "This is ProjectPilot AI, a multi-agent project planning tool for student software projects."
5. Click `Run guided demo`.
6. Pause on the Requirements screen.
7. Say: "The Manager Agent has converted the project idea into requirements."
8. Approve each requirement.
9. Click `Approve requirements -> build tasks`.
10. Pause on the Task Breakdown screen.
11. Say: "Now the Manager Agent has divided the project into tasks and assigned each task to a specialist agent."
12. Point to the Owner column.
13. Click `Approve plan & run agents`.
14. Wait until the Review screen appears.
15. Say: "The agents completed their outputs, and the Review Agent checks for conflicts or missing details."
16. Approve all but one output and request a revision on the remaining output.
17. Continue to feedback, show the selected task, and apply a short revision request.
18. Show the revised output back in Review as pending, then approve it explicitly.
19. Continue to feedback and finalize the approved plan using the secondary skip-revisions action.
20. Show the Markdown download and explain that time savings are demo estimates.
21. Stop recording.

## Short Version For Presentation

ProjectPilot AI takes a rough software project idea and turns it into an organized execution plan. In the demo, the Manager Agent creates requirements, breaks the project into tasks, assigns those tasks to specialist agents, reviews their outputs, and waits for user approval before moving forward. The MVP uses mock AI responses and requires explicit approval of revised outputs. It produces a downloadable plan, not a deployed application.
