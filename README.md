Idle Devotion

Idle Devotion is a complete, store-ready idle game built as a full-stack system, designed and implemented end-to-end. The project emphasizes reliability, state management, and long-running progression under real-world constraints such as mobile platforms, persistence, and asynchronous behavior.

This repository contains the entire production codebase, including frontend game logic, backend services, tests, tooling, and operational documentation.


---

Project Purpose

The goal of Idle Devotion was to design and ship a self-contained system that:

Supports long-running progression without continuous user interaction

Persists and reconciles state reliably across sessions

Separates gameplay logic from persistence and backend concerns

Is deployable to both Google Play and the Apple App Store


The project was built to completion and prepared for store submission, not as a prototype.


---

High-Level Architecture

Idle Devotion is structured as a full-stack application with clear boundaries between concerns.

Frontend

Built using Unity (C#)

Handles game loop, progression logic, UI, and client-side state

Designed to tolerate intermittent connectivity and paused execution

Focus on deterministic state transitions and predictable progression


Backend

Service components implemented in Python / JavaScript

Responsible for persistence, validation, and supporting services

Designed to operate asynchronously and safely handle delayed updates


Supporting Components

Automated tests for critical logic paths

Scripts and tooling to support development, validation, and deployment

Roadmaps and task audits documenting design intent and tradeoffs


This separation was intentional to reduce coupling and make failure modes easier to reason about.

+--------------------+
|    Mobile Client   |
|    Unity (C#)      |
|--------------------|
| - Game Loop        |
| - Progression      |
| - UI / State View  |
+---------+----------+
          |
          | Serialized State / Events
          |
+---------v----------+
|   Backend Services |
|  (Python / JS)     |
|--------------------|
| - Persistence      |
| - Validation       |
| - Async Handling   |
+---------+----------+
          |
          | Storage / State Records
          |
+---------v----------+
|   Data Store       |
|--------------------|
| - Player State     |
| - Progress Metrics |
+--------------------+

---

Key Design Decisions & Tradeoffs

Some of the core decisions made during development:

Deterministic progression over real-time dependency
Progression is calculated from stored state rather than continuous execution, allowing safe idle behavior.

Explicit state modeling
Game state changes are deliberate and auditable, reducing hidden side effects.

Store-ready constraints
Design choices account for mobile OS lifecycle behavior (app suspension, backgrounding, restarts).

Pragmatic scope control
Features were chosen to ensure completion and reliability rather than maximal complexity.


Where tradeoffs were made (performance vs. clarity, flexibility vs. safety), they are documented in the project notes.


---

Testing & Reliability

The project includes automated tests focused on:

Core logic correctness

State transitions

Error handling and edge cases


Testing was used to validate assumptions and prevent regressions during iteration, not as an afterthought.


---

Project Status

✅ Feature complete

✅ Prepared for Google Play and Apple App Store submission

🔄 Future enhancements documented in ROADMAP.md


The codebase reflects a finished product rather than an exploratory prototype.


---

Repository Contents

Game client (Unity / C#)

Backend services

Tests

Development scripts

Roadmaps and task audits

Build and deployment artifacts


Legal and policy documents (privacy policy, terms) are maintained in a separate repository.


---

Why This Project Exists (Context for Reviewers)

This project is included as an example of:

End-to-end ownership of a non-trivial system

Structured reasoning about state, progression, and failure modes

Translating abstract requirements into concrete, shippable software

Producing and maintaining documentation alongside code


It is intended to demonstrate systems thinking and reliability, not just implementation.


---

Contact

Walter Weaver
GitHub: https://github.com/WBZKLLC#