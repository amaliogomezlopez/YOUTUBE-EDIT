#!/usr/bin/env python3
"""Small local Faster-Whisper adapter for Shortsmith.

This is deliberately a CLI process instead of a second HTTP backend. Node remains
the pipeline owner and receives a stable JSON contract with segment and word times.
"""

from __future__ import annotations

import argparse
import json
import os
import site
import sys
from pathlib import Path


_DLL_HANDLES: list[object] = []


def configure_cuda_dlls() -> None:
    """Make pip-installed CUDA 12/cuDNN DLLs visible to CTranslate2 on Windows."""
    if os.name != "nt":
        return
    roots = [Path(value) for value in site.getsitepackages() if Path(value).is_dir()]
    candidates: list[Path] = []
    for root in roots:
        candidates.extend(
            (
                root / "nvidia" / "cublas" / "bin",
                root / "nvidia" / "cudnn" / "bin",
                root / "nvidia" / "cuda_runtime" / "bin",
                root / "ctranslate2",
            )
        )
    for dll_dir in candidates:
        if not dll_dir.is_dir() or not any(dll_dir.glob("*.dll")):
            continue
        value = str(dll_dir)
        os.environ["PATH"] = value + os.pathsep + os.environ.get("PATH", "")
        add_dll_directory = getattr(os, "add_dll_directory", None)
        if add_dll_directory is not None:
            try:
                _DLL_HANDLES.append(add_dll_directory(value))
            except OSError:
                pass


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(description="Transcribe audio locally with word timestamps.")
    cli.add_argument("--audio", required=True)
    cli.add_argument("--output", required=True)
    cli.add_argument("--model", default="small")
    cli.add_argument("--language", default=None)
    cli.add_argument("--device", default="cuda", choices=("auto", "cpu", "cuda"))
    cli.add_argument("--compute-type", default="float16")
    cli.add_argument("--beam-size", type=int, default=5)
    cli.add_argument("--initial-prompt", default=None)
    cli.add_argument("--download-root", default=None)
    cli.add_argument("--vad-filter", action="store_true")
    return cli


def main() -> int:
    args = parser().parse_args()
    configure_cuda_dlls()
    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError:
        print(
            "No se encontró faster-whisper. Ejecuta `npm run stt:setup` desde Shortsmith.",
            file=sys.stderr,
        )
        return 2

    audio = Path(args.audio).resolve()
    output = Path(args.output).resolve()
    if not audio.is_file():
        print(f"Audio no encontrado: {audio}", file=sys.stderr)
        return 2

    output.parent.mkdir(parents=True, exist_ok=True)
    print(
        f"Faster-Whisper local: model={args.model} device={args.device} compute={args.compute_type}",
        file=sys.stderr,
        flush=True,
    )
    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
        download_root=args.download_root,
    )
    generated, info = model.transcribe(
        str(audio),
        language=args.language,
        beam_size=max(1, args.beam_size),
        word_timestamps=True,
        vad_filter=args.vad_filter,
        condition_on_previous_text=False,
        initial_prompt=args.initial_prompt,
        hotwords=args.initial_prompt,
    )

    segments = []
    word_count = 0
    for segment_index, segment in enumerate(generated, start=1):
        words = []
        for word_index, word in enumerate(segment.words or (), start=1):
            text = str(word.word or "").strip()
            if not text or word.start is None or word.end is None or word.end <= word.start:
                continue
            words.append(
                {
                    "id": f"seg-{segment_index}-word-{word_index}",
                    "start": round(float(word.start), 3),
                    "end": round(float(word.end), 3),
                    "text": text,
                    "confidence": round(float(word.probability), 5)
                    if word.probability is not None
                    else None,
                }
            )
        word_count += len(words)
        text = str(segment.text or "").strip()
        if not text:
            continue
        segments.append(
            {
                "id": f"seg-{segment_index}",
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "text": text,
                "words": words,
            }
        )

    payload = {
        "provider": "faster-whisper-local",
        "model": args.model,
        "language": info.language,
        "languageProbability": round(float(info.language_probability), 5),
        "wordTimestamps": True,
        "words": word_count,
        "segments": segments,
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Transcripción terminada: {len(segments)} segmentos, {word_count} palabras.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
