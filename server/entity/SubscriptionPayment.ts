import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

export type SubscriptionPaymentStatus = 'pending' | 'confirmed' | 'rejected';

@Entity()
export class SubscriptionPayment {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'date' })
  public date: Date;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null): number | null => {
        if (v == null || v === '') {
          return null;
        }
        const parsed = parseFloat(v);
        return Number.isNaN(parsed) ? null : parsed;
      },
    },
  })
  public amount: number;

  @Column({ type: 'varchar' })
  public method: string;

  @Column({ type: 'varchar', default: 'confirmed' })
  public status: SubscriptionPaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  public rejectionReason?: string | null;

  @Column()
  public createdByUserId: number;

  @ManyToOne(() => User, (user) => user.subscriptionPayments, {
    onDelete: 'CASCADE',
  })
  @Index()
  public user: User;
}
