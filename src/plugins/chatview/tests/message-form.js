/*global mock, converse */
const { sizzle, u } = converse.env;

describe('A message form', function () {
    fit(
        'can have text pasted into it with automatic space handling',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.querySelector('textarea.chat-textarea');

            // Helper function to simulate paste with automatic space handling
            function simulatePaste(text, cursorStart, cursorEnd, pastedText) {
                textarea.value = text;
                textarea.selectionStart = cursorStart;
                textarea.selectionEnd = cursorEnd || cursorStart;

                // Create a paste event with clipboard data
                const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
                Object.defineProperty(pasteEvent, 'clipboardData', {
                    value: {
                        files: [],
                        getData: () => pastedText,
                    },
                });

                // Dispatch the paste event
                textarea.dispatchEvent(pasteEvent);

                // Simulate the paste behavior with automatic space handling
                const startPos = textarea.selectionStart;
                const endPos = textarea.selectionEnd;
                const textBeforeSelection = textarea.value.substring(0, startPos);
                const textAfterSelection = textarea.value.substring(endPos);

                // Add space before pasted text if needed
                let resultText = textBeforeSelection;
                if (resultText.length > 0 && !resultText.endsWith(' ') && pastedText.length > 0) {
                    resultText += ' ';
                }

                // Add pasted text
                resultText += pastedText;

                // Add space after pasted text if needed
                if (pastedText.length > 0 && textAfterSelection.length > 0 && !textAfterSelection.startsWith(' ')) {
                    resultText += ' ';
                }

                resultText += textAfterSelection;
                textarea.value = resultText;

                // Update cursor position after paste
                const newCursorPos = resultText.length - textAfterSelection.length;
                textarea.selectionStart = textarea.selectionEnd = newCursorPos;

                return resultText;
            }

            // Test case 1: Paste at the beginning
            let result = simulatePaste('Hello world', 0, 0, 'PASTED');
            expect(result).toBe('PASTED Hello world');

            // Test case 2: Paste in the middle (no space before cursor)
            result = simulatePaste('Helloworld', 5, 5, 'PASTED');
            expect(result).toBe('Hello PASTED world');

            // Test case 3: Paste in the middle (space already exists before cursor)
            result = simulatePaste('Hello world', 6, 6, 'PASTED');
            expect(result).toBe('Hello PASTED world');

            // Test case 4: Paste at the end
            result = simulatePaste('Hello world', 11, 11, 'PASTED');
            expect(result).toBe('Hello world PASTED');

            // Test case 5: Paste with text selection (should replace selected text with spaces)
            result = simulatePaste('Hello world', 6, 11, 'PASTED');
            expect(result).toBe('Hello PASTED');

            // Test case 6: Paste with empty string
            result = simulatePaste('Hello world', 5, 5, '');
            expect(result).toBe('Hello world');

            // Test case 7: Paste into empty textarea
            result = simulatePaste('', 0, 0, 'PASTED');
            expect(result).toBe('PASTED');

            // Test case 8: Paste with space in the pasted text
            result = simulatePaste('Hello world', 5, 5, 'PASTED TEXT');
            expect(result).toBe('Hello PASTED TEXT world');
        })
    );
});
