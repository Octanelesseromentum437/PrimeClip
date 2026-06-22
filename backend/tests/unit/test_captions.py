from app.schemas.caption import CaptionCue, CaptionStyle
from app.schemas.transcript import TranscriptSegment, WordSegment
from app.services.captions.ass_builder import AssBuilder
from app.services.captions.chunker import CaptionChunker


def test_chunker_groups_words():
    chunker = CaptionChunker()
    segments = [
        TranscriptSegment(
            start=0.0,
            end=2.0,
            text="hello world foo",
            words=[
                WordSegment(word="hello", start=0.0, end=0.5),
                WordSegment(word="world", start=0.5, end=1.0),
                WordSegment(word="foo", start=1.0, end=1.5),
            ],
        )
    ]
    style = CaptionStyle(words_per_screen=2)
    cues = chunker.chunk_segments(segments, (0.0, 2.0), style)
    assert len(cues) == 2
    assert cues[0].text == "hello world"
    assert cues[1].text == "foo"


def test_ass_builder_includes_style_and_dialogue():
    builder = AssBuilder()
    style = CaptionStyle(font_family="Impact", font_size=80, primary_color="#FFFF00")
    ass = builder.build_ass(style, [CaptionCue(start=0, end=1, text="Hi")])
    assert "Impact" in ass
    assert "Dialogue:" in ass
    assert "Hi" in ass
