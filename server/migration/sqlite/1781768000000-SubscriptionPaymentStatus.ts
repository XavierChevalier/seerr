import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionPaymentStatus1781768000000 implements MigrationInterface {
  name = 'SubscriptionPaymentStatus1781768000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD COLUMN "status" varchar NOT NULL DEFAULT 'confirmed'`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD COLUMN "rejectionReason" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD COLUMN "createdByUserId" integer`
    );
    await queryRunner.query(
      `UPDATE "subscription_payment" SET "createdByUserId" = "userId" WHERE "createdByUserId" IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "createdByUserId"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "rejectionReason"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "status"`
    );
  }
}
