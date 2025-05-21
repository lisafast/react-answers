import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ExpertRatingComponent from '../ExpertRatingComponent.js';

// Helper to select radio by id
const click = (container, selector) => {
  const el = container.querySelector(selector);
  fireEvent.click(el);
};

describe('ExpertRatingComponent', () => {
  it('renders the correct number of sentence groups', () => {
    const { container } = render(
      <ExpertRatingComponent onSubmit={jest.fn()} onClose={jest.fn()} sentenceCount={3} sentences={['a','b','c']} />
    );
    const groups = container.querySelectorAll('.sentence-rating-group');
    expect(groups.length).toBe(3);
  });

  it('computes total score based on ratings', () => {
    const handleSubmit = jest.fn();
    const { container } = render(
      <ExpertRatingComponent onSubmit={handleSubmit} onClose={jest.fn()} sentenceCount={2} sentences={['a','b']} />
    );

    click(container, '#sentence1-100');
    click(container, '#sentence2-80');
    click(container, '#citation-20');

    fireEvent.submit(container.querySelector('form'));

    expect(handleSubmit).toHaveBeenCalled();
    const submitted = handleSubmit.mock.calls[0][0];
    expect(submitted.totalScore).toBe(87.5);
  });

  it('returns null score when no ratings provided', () => {
    const handleSubmit = jest.fn();
    const { container } = render(
      <ExpertRatingComponent onSubmit={handleSubmit} onClose={jest.fn()} />
    );

    fireEvent.submit(container.querySelector('form'));

    expect(handleSubmit).toHaveBeenCalled();
    const submitted = handleSubmit.mock.calls[0][0];
    expect(submitted.totalScore).toBeNull();
  });
});
