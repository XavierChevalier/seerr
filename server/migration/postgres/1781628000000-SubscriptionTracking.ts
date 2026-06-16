import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionTracking1781628000000 implements MigrationInterface {
  name = 'SubscriptionTracking1781628000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "subscriptionPricePerMonth" numeric(10,2)`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "subscriptionStartDate" date`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "subscriptionPreference" character varying`
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_payment" ("id" SERIAL NOT NULL, "date" date NOT NULL, "amount" numeric(10,2) NOT NULL, "method" character varying NOT NULL, "userId" integer, CONSTRAINT "PK_25f8afce4159ee83cf8c6da622d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_gift" ("id" SERIAL NOT NULL, "date" date NOT NULL, "months" integer NOT NULL, "reason" character varying NOT NULL, "userId" integer, CONSTRAINT "PK_13a07409bfaff657d16fe234624" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD CONSTRAINT "FK_2a17e8d0eea74a5607de6aa549a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_gift" ADD CONSTRAINT "FK_a4783a9809ec251659127e3deb9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_gift" DROP CONSTRAINT "FK_a4783a9809ec251659127e3deb9"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP CONSTRAINT "FK_2a17e8d0eea74a5607de6aa549a"`
    );
    await queryRunner.query(`DROP TABLE "subscription_gift"`);
    await queryRunner.query(`DROP TABLE "subscription_payment"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "subscriptionPreference"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "subscriptionStartDate"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "subscriptionPricePerMonth"`
    );
  }
}
