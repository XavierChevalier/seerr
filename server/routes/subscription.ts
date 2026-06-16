import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { isAuthenticated } from '@server/middleware/auth';
import { calculateSubscriptionState } from '@server/utils/subscriptionHelpers';
import { Router } from 'express';

const subscriptionRoutes = Router();

subscriptionRoutes.get(
  '/',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const users = await userRepository.find({
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });

      const results = users.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        subscription: calculateSubscriptionState(user),
      }));

      return res.status(200).json({ results });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

export default subscriptionRoutes;
