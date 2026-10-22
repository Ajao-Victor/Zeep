# TODO

Known issues to handle later. Each entry says where it is, what happens, and when it's planned.

## Layout polish phase

- **Chat history panel covers the thread at tablet widths.** From 640 px (`sm`) up to 1024 px (`lg`), opening the history rail in `components/chat/ChatScreen.tsx` shows the 272 px sidebar as an absolutely positioned overlay (`absolute inset-y-0 left-12`). It covers the left part of the thread, clipping the empty-state text ("…ows the payment, not who you are") and the start of the composer. Seen at 800 px during the Phase 3 browser check. Options: push the thread aside instead of overlaying it, or dim the thread and close the panel on outside click. Planned for the global layout geometry pass, after the component library migration.
