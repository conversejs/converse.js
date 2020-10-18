/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Pure functions to help funcitonally parse messages.
 * @todo Other parsing helpers can be made more abstract and placed here.
 */
const helpers = {};

// Captures all mentions, but includes a space before the @
helpers.mention_regex = /(?:\s|^)([@][\w_-]+(?:\.\w+)*)/ig;

helpers.matchRegexInText = text => regex => text.matchAll(regex);

const escapeRegexChars = (string, char) => string.replace(RegExp('\\' + char, 'ig'), '\\' + char);

helpers.escapeCharacters = characters => string =>
    characters.split('').reduce(escapeRegexChars, string);

helpers.escapeRegexString = helpers.escapeCharacters('[\\^$.?*+(){}');

// `for` is ~25% faster than using `Array.find()`
helpers.findFirstMatchInArray = array => text => {
    for (let i = 0; i < array.length; i++) {
        if (text.localeCompare(array[i], undefined, {sensitivity: 'base'}) === 0) {
            return array[i];
        }
    }
    return null;
};

const reduceReferences = ([text, refs], ref, index) => {
    let updated_text = text;
    let { begin, end } = ref;
    const { value } = ref;
    begin = begin - index;
    end = end - index - 1; // -1 to compensate for the removed @
    updated_text = `${updated_text.slice(0, begin)}${value}${updated_text.slice(end + 1)}`;
    return [updated_text, [...refs, { ...ref, begin, end }]]
}

helpers.reduceTextFromReferences = (text, refs) => refs.reduce(reduceReferences, [text, []]);

export function getStylingReferences (message) {
    const line_space_offsets = {};
    const line_offsets = {};
    const lines = message.split("\n");
    initOffsets(line_space_offsets, line_offsets, lines.length);
    return getMessageStylingReferences(
      lines,
      line_offsets,
      line_space_offsets,
      lines.length - 1
    );
}
export default helpers;

const SPAN_STYLING_DIRECTIVES = {
    '*': 'strong',
    _: 'emphasis',
    '~': 'strike',
    '`': 'preformated',
};

const STYLING_DIRECTIVES = {
    strong: '*',
    emphasis: '_',
    strike: '~',
    preformated: '`',
    preformated_block: '```',
    quote: '>',
};

function isStylingDirective(character) {
    return SPAN_STYLING_DIRECTIVES[character] ? true : false;
}

function hasOpenedSpan(character, spans) {
    for (const span of spans['open']) {
        if (span['type'] === SPAN_STYLING_DIRECTIVES[character]) {
            return true;
        }
    }
    return false;
}

function isOpeningDirective(character, index, line, start) {
    const previous_char = line[index - 1];
    const next_char = line[index + 1];

    if ((index == 0 || index - start === 0) && next_char !== character) return true;
    if (
        (previous_char === ' ' || isStylingDirective(line[index - 1])) &&
        next_char !== ' ' &&
        next_char !== character
    )
        return true;
    return false;
}

function isClosingDirective(index, line) {
    if (line[index - 1] !== ' ') return true;
    return false;
}

function openSpan(character, index, spans) {
    spans['open'].push({
        type: SPAN_STYLING_DIRECTIVES[character],
        begin: index,
    });
}

function voidPreformatedInnerSpans(begin, spans) {
    const final_spans = [];
    for (let index = 0; index < spans['closed'].length; index++) {
        if (spans['closed'][index].begin <= begin) {
            final_spans.push(Object.assign({}, spans['closed'][index]));
        }
    }
    spans['closed'] = [...final_spans];
}

function closeSpan(character, index, offset, spans) {
    let nest_depth;
    let closing_span;
    const span_type = SPAN_STYLING_DIRECTIVES[character];
    for (let idx = 0; idx < spans['open'].length; idx++) {
        if (span_type === spans['open'][idx]['type']) {
            closing_span = Object.assign({}, spans['open'][idx]);
            nest_depth = idx;
            break;
        }
    }
    closing_span['begin'] = closing_span['begin'] + offset;
    closing_span['end'] = index + offset + 1;
    spans['closed'].push(closing_span);
    spans['open'] = [...spans['open'].slice(0, nest_depth)];
    if (span_type === 'preformated') {
        voidPreformatedInnerSpans(closing_span.begin, spans);
    }
}

function getLineSpans (line, offset = 0, start = 0) {
    const spans = { open: [], closed: [] };
    let char;
    for (let index = start; index < line.length; index++) {
        char = line[index];
        if (isStylingDirective(char)) {
            if (!hasOpenedSpan(char, spans)) {
                if (isOpeningDirective(char, index, line, start)) {
                    openSpan(char, index, spans);
                }
            } else {
                if (isClosingDirective(index, line)) {
                    closeSpan(char, index, offset, spans);
                }
            }
        }
    }
    return [...spans['closed']];
}

function initOffsets(line_space_offsets, line_offsets, number_of_lines) {
    for (let index = 0; index < number_of_lines; index++) {
      line_space_offsets[index] = 0;
      line_offsets[index] = 0;
    }
}

function getMessageStylingReferences(lines, line_offsets, line_space_offsets, last_line_index, first_line_index = 0, offset = 0) {
    let local_offset;
    let block_reference; let references = []; let inner_references = [];
    const blocks = { open: []};
    let just_opened = false; let line; let isLastPreformatedLine; let isPreformatedEnding;

    for (let index = first_line_index; index <= last_line_index; index++) {
      line = lines[index];
      // QUOTE BLOCK
      if (
        isQuote(line, line_offsets, line_space_offsets, index) &&
        !blockIsOpened(blocks, "PREFORMATED")
      ) {
        if (!blockIsOpened(blocks)) {
          openBlock("QUOTE", offset, line_offsets, line_space_offsets, index, blocks, line);
        }
        applyLineSpaceOffset(line, line_offsets, line_space_offsets, index);

        if (isLastBlockLine(index, last_line_index, "QUOTE", line_offsets, line_space_offsets, lines)) {
          const { begin, index_begin, block_reference } = closeBlock(offset, blocks, line);
          inner_references = getMessageStylingReferences(lines, line_offsets, line_space_offsets, index, index_begin, begin);
          references = [...references, ...inner_references, ...block_reference];
        }
      } // PREFORMATED BLOCK
      else if (
        isPreformatedBlock(line, line_offsets, line_space_offsets, index) ||
        blockIsOpened(blocks, "PREFORMATED")
      ) {
        local_offset = line_space_offsets[index] + line_offsets[index];
        if (local_offset !== 0 ) {
            if(index !== first_line_index) {
                block_reference = applyLineBlankReference(line, offset, local_offset);
                references = [...references, block_reference];
            }
            else if(line_offsets[index -1] > 0 && line_offsets[index] > line_offsets[index -1] && index > 0) {
                references = [...references, { type: "BLANK", begin: offset, end: offset + local_offset - 1 }];
            }
        }
        if (!blockIsOpened(blocks)) {
          openBlock("PREFORMATED", offset, line_offsets, line_space_offsets, index, blocks, line);
          just_opened = true;
        }
        isLastPreformatedLine = isLastBlockLine(index, last_line_index, "PREFORMATED", line_offsets, line_space_offsets, lines);
        isPreformatedEnding = isPreformatedBlockEnding(line, line_offsets, line_space_offsets, index);
        if (isLastPreformatedLine || (!just_opened && isPreformatedEnding)) {
          if (isPreformatedEnding) {
            const { block_reference } = closeBlock(offset, blocks, line, STYLING_DIRECTIVES.preformated_block.length);
            references = [...references, ...block_reference];
          } else {
            const { block_reference } = closeBlock(offset, blocks, line);
            references = [...references, ...block_reference];
          }
        }
      } // PLAIN
      else if (!blockIsOpened(blocks, "PREFORMATED")) {
        local_offset = line_space_offsets[index] + line_offsets[index];
        if (local_offset !== 0) {
            if (index === first_line_index) {
                if(line_offsets[index -1] > 0 && line_offsets[index] > line_offsets[index -1] && index > 0) {
                    references = [...references, { type: "BLANK", begin: offset, end: offset + local_offset - 1 }];
                }
                if (line[local_offset] === ' ') {
                    references = [...references, { type: "BLANK", begin: offset + local_offset, end: offset + local_offset + 1}];
                    local_offset = local_offset + 1;
                }
            } else {
                block_reference = applyLineBlankReference(line, offset, local_offset);
                references = [...references, block_reference];
                if (line[local_offset] === ' ') local_offset = local_offset + 1;
            }
        }
        references = [...references, ...getLineSpans(line, offset, local_offset)];
      }
      just_opened = false;
      offset = offset + line.length + 1;
    }
    return references;
}

function applyLineBlankReference(line, offset, local_offset) {
    const local_line = line.slice(local_offset);
    const blank_reference = { type: "BLANK", begin: offset};
    if (local_line.startsWith(" " + STYLING_DIRECTIVES.quote)) {
        blank_reference.end = offset + local_offset - 1;
    } else {
        blank_reference.end = offset + local_offset;
    }
    if (local_line[0] === ' ') blank_reference.end = blank_reference.end + 1;
    return blank_reference;
}

function openBlock(type, text_offset, line_offsets, line_space_offsets, begin, blocks, line) {
    const local_offset = line_space_offsets[begin] + line_offsets[begin];
    const total_offset = local_offset + text_offset;
    if (type === "QUOTE") {
      if (line[local_offset] === STYLING_DIRECTIVES.quote) {
        blocks["open"].push({
          type: "QUOTE",
          begin_line: begin,
          begin: total_offset,
          beginning_offset: STYLING_DIRECTIVES.quote.length,
          text_offset,
        });
      } else if (
        line_offsets[begin] !== 0 &&
        line[local_offset + 1] === STYLING_DIRECTIVES.quote
      ) {
        blocks["open"].push({
          type: "QUOTE",
          begin_line: begin,
          begin: total_offset,
          beginning_offset: STYLING_DIRECTIVES.quote.length + 1,
          text_offset,
        });
      }
    } else if (type === "PREFORMATED") {
      const local_line = line.slice(local_offset);
      if (local_line.startsWith(STYLING_DIRECTIVES.preformated_block)) {
        blocks["open"].push({
          type: "PREFORMATED",
          begin_line: begin,
          begin: total_offset,
          beginning_offset: STYLING_DIRECTIVES.preformated_block.length,
          text_offset,
        });
      } else if (
        line_offsets[begin] !== 0 &&
        local_line.startsWith(" " + STYLING_DIRECTIVES.preformated_block)
      ) {
        blocks["open"].push({
          type: "PREFORMATED",
          begin_line: begin,
          begin: total_offset,
          beginning_offset: STYLING_DIRECTIVES.preformated_block.length + 1,
          text_offset,
        });
      }
    }
}

function closeBlock(text_offset, blocks, line, closing_offset = 0) {
    const total_offset = text_offset + line.length;
    const current_block = { ...blocks["open"][0] };
    blocks["open"] = [];
    return {
      begin: current_block.text_offset,
      index_begin: current_block.begin_line,
      block_reference: [
        { ...current_block, end: total_offset, closing_offset },
      ],
    };
}

function blockIsOpened(blocks, type = "") {
    if (blocks["open"].length) {
      if (type) {
        return blocks["open"][0].type === type;
      }
      return true;
    }
    return false;
}

function applyLineSpaceOffset(line, line_offsets, line_space_offsets, line_index) {
    const local_offset = line_space_offsets[line_index] + line_offsets[line_index];
    const local_line = line.slice(local_offset);
    if (
      line_offsets[line_index] !== 0 &&
      local_line.startsWith(" " + STYLING_DIRECTIVES.quote)
    ) {
      line_space_offsets[line_index] = line_space_offsets[line_index] + 1;
    }
    line_offsets[line_index] = line_offsets[line_index] + 1;
}

function isQuote(line, line_offsets, line_space_offsets, line_index) {
    const local_offset = line_space_offsets[line_index] + line_offsets[line_index];
    const local_line = line.slice(local_offset);
    if (local_line.startsWith(STYLING_DIRECTIVES.quote)) return true;
    // Already inside a quote block.
    if (line_offsets[line_index] !== 0) {
      if (local_line.startsWith(" " + STYLING_DIRECTIVES.quote)) {
        return true;
      }
    }
    return false;
}

function isPreformatedBlock(line, line_offsets, line_space_offsets, line_index) {
    const local_offset = line_space_offsets[line_index] + line_offsets[line_index];
    const local_line = line.slice(local_offset);
    if (local_line.startsWith(STYLING_DIRECTIVES.preformated_block)) return true;
    // Already inside a quote block.
    if (line_offsets[line_index] !== 0) {
      if (local_line.startsWith(" " + STYLING_DIRECTIVES.preformated_block)) {
        return true;
      }
    }
    return false;
}

function isPreformatedBlockEnding(line, line_offsets, line_space_offsets, line_index) {
    const local_offset = line_space_offsets[line_index] + line_offsets[line_index];
    const local_line = line.slice(local_offset);
    if (local_line === STYLING_DIRECTIVES.preformated_block) return true;
    if (line_offsets[line_index] !== 0) {
      if (local_line === " " + STYLING_DIRECTIVES.preformated_block) {
        return true;
      }
    }
    return false;
}

function isLastBlockLine(line_index, last_line_index, type, line_offsets, line_space_offsets, lines) {
    if (line_index === last_line_index) return true;
    if (type === "QUOTE") {
      return !isQuote(
        lines[line_index + 1],
        line_offsets,
        line_space_offsets,
        line_index + 1
      );
    }
    return false;
}
