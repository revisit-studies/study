import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it,
} from 'vitest';
import { DelayedResponseWrapper } from '../DelayedResponseWrapper';

describe('DelayedResponseWrapper', () => {
  it('passes isDelayedDisabled as true initially when a delay is specified', () => {
    let capturedState: boolean | undefined;

    renderToStaticMarkup(
      <DelayedResponseWrapper delay={5000} disabled={false}>
        {(isDelayedDisabled) => {
          capturedState = isDelayedDisabled;
          return <div data-disabled={isDelayedDisabled}>Test Content</div>;
        }}
      </DelayedResponseWrapper>,
    );

    expect(capturedState).toBe(true);
  });

  it('passes isDelayedDisabled as false when delay is 0 or undefined', () => {
    let capturedState: boolean | undefined;

    renderToStaticMarkup(
      <DelayedResponseWrapper delay={0} disabled={false}>
        {(isDelayedDisabled) => {
          capturedState = isDelayedDisabled;
          return <div data-disabled={isDelayedDisabled}>Test Content</div>;
        }}
      </DelayedResponseWrapper>,
    );

    expect(capturedState).toBe(false);
  });

  it('respects parent disabled prop even if delay is 0', () => {
    let capturedState: boolean | undefined;

    renderToStaticMarkup(
      <DelayedResponseWrapper delay={0} disabled>
        {(isDelayedDisabled) => {
          capturedState = isDelayedDisabled;
          return <div data-disabled={isDelayedDisabled}>Test Content</div>;
        }}
      </DelayedResponseWrapper>,
    );

    expect(capturedState).toBe(true);
  });
});
