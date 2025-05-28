import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import FeedbackComponent from '../FeedbackComponent.js';
import DataStoreService from '../../../services/DataStoreService.js';

jest.mock('../../../services/DataStoreService.js', () => ({
  __esModule: true,
  default: { persistFeedback: jest.fn() },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve));

describe('FeedbackComponent', () => {
  beforeEach(() => {
    DataStoreService.persistFeedback.mockClear();
  });

  it('shows thank you message on positive feedback', async () => {
    render(<FeedbackComponent chatId="c1" userMessageId="u1" />);
    fireEvent.click(screen.getByText('Good'));
    await flushPromises();

    expect(DataStoreService.persistFeedback).toHaveBeenCalledWith(
      { totalScore: 100, isPositive: true },
      'c1',
      'u1'
    );
    expect(screen.getByText('Thank you for your feedback!')).toBeInTheDocument();
  });

  it('opens expert rating when negative feedback clicked', () => {
    const { container } = render(
      <FeedbackComponent chatId="c1" userMessageId="u1" sentenceCount={2} sentences={["a","b"]} />
    );
    fireEvent.click(screen.getByText('Needs improvement'));
    expect(container.querySelector('.expert-rating-container')).toBeInTheDocument();
  });

  it('persists expert feedback on submit', async () => {
    render(<FeedbackComponent chatId="c1" userMessageId="u1" sentenceCount={1} sentences={['a']} />);
    fireEvent.click(screen.getByText('Needs improvement'));
    fireEvent.click(screen.getByLabelText('Good (100)'));
    fireEvent.click(screen.getByText('Submit feedback'));
    await flushPromises();

    expect(DataStoreService.persistFeedback).toHaveBeenCalledTimes(1);
    const call = DataStoreService.persistFeedback.mock.calls[0];
    expect(call[1]).toBe('c1');
    expect(call[2]).toBe('u1');
  });

  it('renders skip button when enabled', () => {
    render(
      <FeedbackComponent chatId="c1" userMessageId="u1" showSkipButton skipButtonLabel="Skip" onSkip={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });
});
