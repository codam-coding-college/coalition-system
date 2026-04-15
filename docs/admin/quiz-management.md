# Quiz Management

The quiz management admin section allows staff to create, read, update, and delete (CRUD) the Sorting Hat quiz content, as well as configure the availability window.

## Quiz Settings

The quiz availability window is controlled by a single `CodamCoalitionTestSettings` record (id = 1).

| Field | Description |
|-------|-------------|
| `start_at` | When the quiz becomes available to students |
| `deadline_at` | When the quiz closes |

Outside this window, students cannot access the quiz, unless they are not assigned to any coalition yet.

Only students with an ongoing cursus specified by `INTRA_CURSUS_ID` can take the quiz. If [ASSISTANTS_CAN_QUIZ](../configuration.md) is enabled, Piscine Assistants can also take the quiz regardless of their cursus status.

## Managing Questions

Questions are `CodamCoalitionTestQuestion` records. Each question has a text string and a set of answers (one per coalition).

The admin interface at `/admin/quiz` allows:
- Creating new questions
- Editing existing question text
- Deleting questions (also deletes all associated answers)

## Managing Answers

Each answer (`CodamCoalitionTestAnswer`) is associated with a specific question and a specific coalition. The weight field determines how much that answer influences the quiz result toward the associated coalition.

| Field | Description |
|-------|-------------|
| `answer` | The text of the answer option |
| `coalition_id` | Which coalition this answer points to |
| `weight` | Score added to that coalition's tally when this answer is chosen (default 10, can be negative) |

For a question with N coalitions, there should be exactly N answers — one per coalition. The quiz scoring sums the weights per coalition across all answered questions and assigns the student to the coalition with the highest total.

The admin interface allows editing the answer text and weight for each answer. Answer order is randomized per student when the quiz is displayed, so the position of answers in the admin interface does not affect what students see.

## Routes

| Route | Description |
|-------|-------------|
| `GET /admin/quiz` | Manage quiz availability and questions |
| `GET/POST /admin/quiz/questions/:id/edit` | Edit a question |
| `POST /admin/quiz/questions/:id/delete` | Delete a question and its answers |
| `GET/POST /admin/quiz/answers/:id/edit` | Edit an answer's text, to which question and coalition it belongs, and its weight |
| `POST /admin/quiz/answers/:id/delete` | Delete an answer |
