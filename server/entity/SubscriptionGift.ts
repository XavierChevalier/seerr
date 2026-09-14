import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Entity()
export class SubscriptionGift {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'date' })
  public date: Date;

  @Column({ type: 'int' })
  public months: number;

  @Column({ type: 'varchar' })
  public reason: string;

  @ManyToOne(() => User, (user) => user.subscriptionGifts, {
    onDelete: 'CASCADE',
  })
  @Index()
  public user: User;
}
