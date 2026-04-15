# Sorting Hat Quiz

## Overview

New students are assigned to a coalition through a questionnaire — the "Sorting Hat" quiz. Students answer a series of multiple-choice questions, each answer weighted toward a specific coalition. The student is placed in the coalition with the highest cumulative weight.

## Availability Window

The quiz is only available between `CodamCoalitionTestSettings.start_at` and `CodamCoalitionTestSettings.deadline_at`. Outside this window, accessing `/quiz` shows a message indicating the quiz is not yet available or has already closed. However, students who are not yet assigned to any coalition can still access the quiz at any time to get placed into a coalition.

Only one `CodamCoalitionTestSettings` record should exist (id = 1). It is managed via the admin interface.

## Quiz Flow

1. The student visits `/quiz`.
2. Questions are presented one at a time. Answer order within each question is randomized on each page load to prevent positional bias.
3. Answers are stored in the session (`session.quiz`) as the student progresses.
4. After all questions are answered, the system tallies the weights per coalition.
5. The student is recommended to join a coalition based on the highest score. They can choose to accept the recommendation or pick a different coalition.
6. Their `IntraCoalitionUser` record is created or updated via the Intra API.

> Due to Intra's technical limitations, a student can only be assigned to a coalition with an active cursus. If the user has no active cursus, the cursus will temporarily get reopened on Intra to allow coalition assignment, then closed again immediately after with the original data kept intact. This applies especially to Piscine Assistants when the coalition system is set up to run for a piscine.

## Data Model

**`CodamCoalitionTestQuestion`**: One record per question.

**`CodamCoalitionTestAnswer`**: Multiple answers per question, one per coalition. Each answer has:
- `answer` — the text displayed to the student
- `coalition_id` — which coalition this answer points to
- `weight` — how many points this answer adds to that coalition's score (default 10; can be negative)

Example: A question with 3 answers, each pointing to a different coalition with weights 10, 5, and -2.

## Piscine Assistant Participation

By default, Piscine Assistants (identified by `INTRA_ASSISTANT_GROUP_ID`) cannot take the quiz.

When `ASSISTANTS_CAN_QUIZ=true`, Piscine Assistants are allowed to take the quiz even outside the normal availability window. This is intended for the piscine period, where Piscine Assistants participate in a separate piscine-specific coalition system running alongside the main one.
