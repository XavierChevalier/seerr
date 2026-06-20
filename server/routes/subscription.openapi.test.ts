import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import yaml from 'js-yaml';

describe('subscription OpenAPI spec', () => {
  const spec = yaml.load(readFileSync('seerr-api.yml', 'utf8')) as {
    paths: Record<string, unknown>;
    components: { schemas: Record<string, unknown> };
  };

  it('declares user subscription endpoints required by express-openapi-validator', () => {
    assert.ok(spec.paths['/user/{userId}/subscription']);
    assert.ok(spec.paths['/user/{userId}/subscription/recurring']);
    assert.ok(spec.paths['/user/{userId}/subscription/payment']);
    assert.ok(spec.paths['/user/{userId}/subscription/payment/{paymentId}']);
    assert.ok(
      spec.paths['/user/{userId}/subscription/payment/{paymentId}/confirm']
    );
    assert.ok(
      spec.paths['/user/{userId}/subscription/payment/{paymentId}/reject']
    );
    assert.ok(spec.paths['/user/{userId}/subscription/gift']);
    assert.ok(spec.paths['/user/{userId}/subscription/gift/{giftId}']);
    assert.ok(spec.paths['/subscription']);
    assert.ok(spec.paths['/subscription/count']);
    assert.ok(spec.paths['/subscription/payments']);
    assert.ok(spec.paths['/subscription/status']);
  });

  it('declares subscription response schemas', () => {
    assert.ok(spec.components.schemas.UserSubscription);
    assert.ok(spec.components.schemas.RecurringTransfer);
    assert.ok(spec.components.schemas.SubscriptionOverviewItem);
    assert.ok(spec.components.schemas.SubscriptionPaymentListItem);
    assert.ok(spec.components.schemas.SubscriptionStatusResponse);
    assert.ok(spec.components.schemas.SubscriptionPaymentStatus);
  });
});
