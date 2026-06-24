import TheMovieDb from '@server/api/themoviedb';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

Object.defineProperty(TheMovieDb.prototype, 'getMovie', {
  get() {
    return async ({ movieId }: { movieId: number }) => ({
      id: movieId,
      external_ids: { tvdb_id: null },
      genres: [],
      original_language: 'en',
      keywords: { results: [] },
    });
  },
  set() {},
  configurable: true,
});

setupTestDb();

describe('MediaRequest.request deleted media re-request', () => {
  beforeEach(() => {
    MediaRequest.sendNotification = async () => undefined;
  });

  it('allows re-requesting deleted media with a stale pending request', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 88003,
        status: MediaStatus.DELETED,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const staleRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy: user,
        is4k: false,
      })
    );

    const newRequest = await MediaRequest.request(
      {
        mediaId: 88003,
        mediaType: MediaType.MOVIE,
        is4k: false,
      },
      user
    );

    assert.ok(newRequest.id, 'A new request should be created');

    const updatedStaleRequest = await requestRepo.findOneOrFail({
      where: { id: staleRequest.id },
    });

    assert.strictEqual(
      updatedStaleRequest.status,
      MediaRequestStatus.COMPLETED,
      'Stale pending requests should be completed before creating a new request'
    );

    const updatedMedia = await mediaRepo.findOneOrFail({
      where: { id: media.id },
    });

    assert.strictEqual(
      updatedMedia.status,
      MediaStatus.PENDING,
      'Deleted media should transition back to pending when re-requested'
    );
  });
});
