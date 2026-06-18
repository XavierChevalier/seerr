import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionPaymentStatus1781768000000 implements MigrationInterface {
  name = 'SubscriptionPaymentStatus1781768000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD "status" character varying NOT NULL DEFAULT 'confirmed'`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD "rejectionReason" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD "createdByUserId" integer`
    );
    await queryRunner.query(
      `UPDATE "subscription_payment" SET "createdByUserId" = "userId" WHERE "createdByUserId" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ALTER COLUMN "createdByUserId" SET NOT NULL`
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
