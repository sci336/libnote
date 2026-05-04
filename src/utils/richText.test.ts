import { describe, expect, it } from 'vitest';
import { contentToPlainText, sanitizePastedHtml, sanitizePastedPlainText } from './richText';

describe('richText paste sanitization', () => {
  it('preserves plain text paste with clean line breaks', () => {
    expect(sanitizePastedPlainText('First line\r\nSecond line\n\nFourth line')).toBe(
      'First line<br>Second line<br><br>Fourth line'
    );
  });

  it('preserves safe inline formatting', () => {
    expect(sanitizePastedHtml('<p><b>Bold</b> <i>Italic</i> <u>Underline</u> <mark>Marked</mark></p>')).toBe(
      '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u> <mark>Marked</mark></p>'
    );
  });

  it('normalizes pasted highlight styles to mark elements', () => {
    expect(sanitizePastedHtml('<p><span style="background-color: yellow; color: red;">Highlighted</span></p>')).toBe(
      '<p><mark>Highlighted</mark></p>'
    );
  });

  it('preserves unordered and ordered lists', () => {
    expect(sanitizePastedHtml('<ul><li>One</li><li><b>Two</b></li></ul><ol><li>First</li></ol>')).toBe(
      '<ul><li>One</li><li><strong>Two</strong></li></ul><ol><li>First</li></ol>'
    );
  });

  it('preserves app task-list attributes through the safe paste subset', () => {
    const html = sanitizePastedHtml(
      '<ul data-list-type="task"><li data-task-item="true" data-checked="true">Done</li><li>Todo</li></ul>'
    );

    expect(html).toBe(
      '<ul data-list-type="task"><li data-task-item="true" data-checked="true">Done</li><li data-task-item="true" data-checked="false">Todo</li></ul>'
    );
    expect(contentToPlainText(html)).toBe('- [x] Done\n- [ ] Todo');
  });

  it('preserves practical heading levels', () => {
    expect(sanitizePastedHtml('<h1>Main</h1><h4>Deep heading</h4>')).toBe('<h1>Main</h1><h3>Deep heading</h3>');
  });

  it('removes scripts and external embeds', () => {
    expect(sanitizePastedHtml('<p>Keep</p><script>alert("x")</script><iframe src="https://example.com"></iframe>')).toBe(
      '<p>Keep</p>'
    );
  });

  it('removes inline event handlers while keeping safe text formatting', () => {
    expect(sanitizePastedHtml('<p onclick="steal()"><strong onmouseover="steal()">Safe</strong></p>')).toBe(
      '<p><strong>Safe</strong></p>'
    );
  });

  it('cleans outside-app styles and layout wrappers', () => {
    expect(
      sanitizePastedHtml(
        '<div style="display:grid"><span style="font-family:Papyrus;font-size:48px;color:red">Styled</span></div>'
      )
    ).toBe('<p>Styled</p>');
  });

  it('keeps pasted wiki links as searchable plain text', () => {
    const html = sanitizePastedHtml('<p>See <span style="color:blue">[[Page Title]]</span></p>');

    expect(html).toBe('<p>See [[Page Title]]</p>');
    expect(contentToPlainText(html)).toBe('See [[Page Title]]');
  });

  it('keeps pasted slash tags as searchable plain text', () => {
    const html = sanitizePastedHtml('<p>Read more in <span style="font-size:18px">/history</span></p>');

    expect(html).toBe('<p>Read more in /history</p>');
    expect(contentToPlainText(html)).toBe('Read more in /history');
  });

  it('extracts inline formatted HTML as continuous visible text', () => {
    expect(contentToPlainText('<p>Hello <strong>bold</strong> <em>italic</em> <u>under</u></p>')).toBe(
      'Hello bold italic under'
    );
  });
});
