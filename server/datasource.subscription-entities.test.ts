import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { entities } from '@server/datasource';
import { SubscriptionGift } from '@server/entity/SubscriptionGift';
import { SubscriptionPayment } from '@server/entity/SubscriptionPayment';

describe('datasource subscription entities', () => {
  it('registers fork subscription entities after explicit TypeORM entity list', () => {
    assert.ok(
      entities.includes(SubscriptionPayment),
      'SubscriptionPayment must be in DataSource entities'
    );
    assert.ok(
      entities.includes(SubscriptionGift),
      'SubscriptionGift must be in DataSource entities'
    );
  });
});
