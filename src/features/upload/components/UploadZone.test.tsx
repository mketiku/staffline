import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { UploadZone } from './UploadZone';

describe('UploadZone', () => {
  it('renders the prompt text and browse button', () => {
    render(<UploadZone onUpload={vi.fn()} />);
    expect(screen.getByText('Drop your audio file here')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /browse files/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/MP3, M4A, AAC, WAV/)).toBeInTheDocument();
  });

  it('calls onUpload with a valid audio file on drop', () => {
    const onUpload = vi.fn();
    const { container } = render(<UploadZone onUpload={onUpload} />);
    const dropZone = container.firstChild as HTMLElement;

    const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('does not call onUpload when the dropped file type is not accepted', () => {
    const onUpload = vi.fn();
    const { container } = render(<UploadZone onUpload={onUpload} />);
    const dropZone = container.firstChild as HTMLElement;

    const file = new File(['data'], 'document.pdf', {
      type: 'application/pdf',
    });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(onUpload).not.toHaveBeenCalled();
  });

  it('accepts audio/wav files', () => {
    const onUpload = vi.fn();
    const { container } = render(<UploadZone onUpload={onUpload} />);
    const dropZone = container.firstChild as HTMLElement;

    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('calls onUpload when a file is chosen via the hidden input', () => {
    const onUpload = vi.fn();
    render(<UploadZone onUpload={onUpload} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const file = new File(['audio'], 'track.m4a', { type: 'audio/mp4' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('disables the Browse button and dims the zone when disabled', () => {
    render(<UploadZone onUpload={vi.fn()} disabled />);
    expect(
      screen.getByRole('button', { name: /browse files/i })
    ).toBeDisabled();
    const { container } = render(<UploadZone onUpload={vi.fn()} disabled />);
    expect((container.firstChild as HTMLElement).className).toContain(
      'opacity-50'
    );
  });

  it('tracks drag-over and drag-leave without throwing', () => {
    const { container } = render(<UploadZone onUpload={vi.fn()} />);
    const dropZone = container.firstChild as HTMLElement;
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
  });
});
