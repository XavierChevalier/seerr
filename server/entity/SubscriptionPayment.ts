import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

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
      from: (v: string) => parseFloat(v),
    },
  })
  public amount: number;

  @Column({ type: 'varchar' })
  public method: string;

  @ManyToOne(() => User, (user) => user.subscriptionPayments, {
    onDelete: 'CASCADE',
  })
  @Index()
  public user: User;
}
