import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionRecurringTransfer1782000000000 implements MigrationInterface {
  name = 'SubscriptionRecurringTransfer1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "subscriptionRecurringEnabled" boolean NOT NULL DEFAULT (0)`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "subscriptionRecurringDayOfMonth" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "subscriptionRecurringDayOfMonth"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "subscriptionRecurringEnabled"`
    );
  }
}
