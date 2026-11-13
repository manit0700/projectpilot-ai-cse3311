# Demo Script — Feature 1: Project Idea Input

Scope: only Step 1 of 8 ("Idea"). Stop before Clarify.

## Setup

- `http://localhost:3000` open, on the New Project screen, before you start talking.
- Mock AI mode (no API key, no network dependency — safe for live demo).

## Script (speak this)

"This is ProjectPilot AI — a student-focused AI project manager for class projects, hackathons, and portfolio apps. It's not just a chatbot. It acts like a project manager that coordinates multiple specialized agents, and it always waits for human approval before moving forward.

The first feature is the project idea intake screen — this is where the whole workflow starts.

Right here, the user types a project idea in plain language — for example, a campus study-group matcher with availability calendars and course filters — along with who the target user is, like CSE students or hackathon teammates.

*(click 'Load sample text')*

I'll load a sample idea so you can see real input instead of a blank field.

Notice the app won't let you continue with a placeholder or an empty idea — it requires at least 12 characters, so the Manager Agent always has enough to work with before it starts asking clarifying questions.

There are two ways forward from here. 'Start clarifying questions' begins the real step-by-step flow — the Manager Agent will ask follow-up questions before writing requirements. 'Run guided workflow' is the fast classroom-demo path — it walks the full idea-to-plan pipeline automatically, which is what we'll use later in this demo when we get past requirements and tasks.

On the right, the Manager Agent's update panel is already listening — once a project starts, every planning decision the Manager Agent makes gets logged here in plain language, so nothing happens silently.

That's the first feature: a single, constrained entry point that forces a real idea and a real target user before any agent work begins. Next, I'll show how the Manager Agent turns this into clarifying questions."

## Talking points if asked questions

- Why require 12 characters? Stops empty/garbage input from wasting the Manager Agent's planning step.
- Why ask for target user here, not later? Keeps every downstream requirement traceable to who it's for.
- Is this calling a real AI model? No — mock responses for reliability in Iteration 1; live API is a later-iteration item (see `docs/CURRENT_STATUS.md`).
