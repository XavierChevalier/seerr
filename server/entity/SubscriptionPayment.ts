import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class SubscriptionPayment {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'date' })
  public date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  public amount: number;

  @Column({ type: 'varchar' })
  public method: string;

  @ManyToOne(() => User, (user) => user.subscriptionPayments, {
    onDelete: 'CASCADE',
  })
  public user: User;
}
