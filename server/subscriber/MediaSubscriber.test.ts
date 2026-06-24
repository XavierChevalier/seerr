import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

setupTestDb();

describe('MediaSubscriber deleted media request completion', () => {
  it('completes pending movie requests when media is marked deleted', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 88001,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const pendingRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy: user,
        is4k: false,
      })
    );

    media.status = MediaStatus.DELETED;
    await mediaRepo.save(media);

    const updatedRequest = await requestRepo.findOneOrFail({
      where: { id: pendingRequest.id },
    });

    assert.strictEqual(
      updatedRequest.status,
      MediaRequestStatus.COMPLETED,
      'Pending requests should be completed when media is deleted'
    );
  });

  it('completes pending tv requests when the show is marked deleted', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);
    const seasonRequestRepo = getRepository(SeasonRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.TV,
        tmdbId: 88002,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        seasons: [
          new Season({
            seasonNumber: 1,
            status: MediaStatus.AVAILABLE,
            status4k: MediaStatus.UNKNOWN,
          }),
        ],
      })
    );

    const pendingRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.TV,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy: user,
        is4k: false,
      })
    );

    await seasonRequestRepo.save(
      new SeasonRequest({
        seasonNumber: 1,
        status: MediaRequestStatus.PENDING,
        request: pendingRequest,
      })
    );

    media.status = MediaStatus.DELETED;
    await mediaRepo.save(media);

    const updatedRequest = await requestRepo.findOneOrFail({
      where: { id: pendingRequest.id },
      relations: { seasons: true },
    });

    assert.strictEqual(
      updatedRequest.status,
      MediaRequestStatus.COMPLETED,
      'Pending TV requests should be completed when the show is deleted'
    );
    assert.strictEqual(
      updatedRequest.seasons[0].status,
      MediaRequestStatus.COMPLETED,
      'Pending season requests should be completed when the show is deleted'
    );
  });
});
