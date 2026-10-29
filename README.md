# SillyTavern-Markdown-Tables
This is an extension for [SillyTavern](https://github.com/SillyTavern/SillyTavern) to render Markdown Tables.

Models often write tables that SillyTavern shows as raw text full of pipes, for example when there's no blank line before the table. This extension finds those tables after a message is rendered and turns them into styled HTML tables.

```
| Item   | Qty | Price |
|:-------|:---:|------:|
| Potion |  2  |  50g  |
| Sword  |  1  | 300g  |
```

## Features
- Tables fold up into a dropdown. Its clickable label shows the header row and the number of rows. Click it to open the full table.
- Works on new, streamed, edited, and swiped messages, and on chats loaded from history.
- Supports column alignment (`:---`, `:---:`, `---:`), optional leading and trailing pipes, escaped pipes (`\|`), and pipes inside `` `code` ``.
- Keeps inline formatting (bold, italics, code) inside cells.
- Leaves code blocks alone.
- Wide tables scroll sideways instead of overflowing the message.
- Table colors follow your SillyTavern theme.

## Installation
1. In SillyTavern, open **Extensions** → **Install extension**.
2. Paste `https://github.com/LoneTitan01/SillyTavern-Markdown-Tables` and click **Install**.

## Settings
In the Extensions panel, open the **Markdown Tables** drawer:
- **Render Markdown tables in messages**: turns the extension on or off.
- **Apply table styling to all tables in chat**: also applies the theme styling to tables SillyTavern already renders on its own.
- **Show tables as collapsible dropdowns**: on by default. Turn it off to show tables fully open with no dropdown.
- **Dropdowns start expanded**: open every dropdown by default. They can still be clicked closed.

## Requirements
SillyTavern 1.12 or newer.
