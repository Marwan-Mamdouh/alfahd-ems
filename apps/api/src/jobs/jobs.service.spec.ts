import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service.js';

describe('JobsService', () => {
  it('throws NotFoundException when job does not exist', async () => {
    const queueMock = {
      getJob: vi.fn().mockResolvedValue(null),
    } as any;

    const service = new JobsService(queueMock);
    await expect(service.getJobStatus('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('returns mapped status and downloadUrl for completed job', async () => {
    const queueMock = {
      getJob: vi.fn().mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: { downloadUrl: 'https://cdn.example.com/report.xlsx' },
        failedReason: null,
      }),
    } as any;

    const service = new JobsService(queueMock);
    const result = await service.getJobStatus('job-123');

    expect(result).toEqual({
      id: 'job-123',
      status: 'COMPLETED',
      downloadUrl: 'https://cdn.example.com/report.xlsx',
      error: null,
    });
  });

  it('returns RUNNING and FAILED statuses properly', async () => {
    const runningJobMock = {
      id: 'job-active',
      getState: vi.fn().mockResolvedValue('active'),
      returnvalue: null,
      failedReason: null,
    };
    const failedJobMock = {
      id: 'job-failed',
      getState: vi.fn().mockResolvedValue('failed'),
      returnvalue: null,
      failedReason: 'Something blew up',
    };

    const queueMock = {
      getJob: vi.fn((id: string) => {
        if (id === 'active') return Promise.resolve(runningJobMock);
        if (id === 'failed') return Promise.resolve(failedJobMock);
        return Promise.resolve(null);
      }),
    } as any;

    const service = new JobsService(queueMock);

    const activeRes = await service.getJobStatus('active');
    expect(activeRes.status).toBe('RUNNING');

    const failedRes = await service.getJobStatus('failed');
    expect(failedRes.status).toBe('FAILED');
    expect(failedRes.error).toBe('Something blew up');
  });

  describe('authorization', () => {
    const jobMock = {
      id: 'job-auth',
      data: { requestedBy: 'user-owner' },
      getState: vi.fn().mockResolvedValue('completed'),
      returnvalue: { downloadUrl: 'https://cdn.example.com/report.xlsx' },
      failedReason: null,
    };

    const queueMock = {
      getJob: vi.fn().mockResolvedValue(jobMock),
    } as any;

    it('allows Admin to query any job', async () => {
      const service = new JobsService(queueMock);
      const res = await service.getJobStatus('job-auth', {
        userId: 'admin-id',
        role: 'ADMIN',
      } as any);
      expect(res.id).toBe('job-auth');
    });

    it('allows requester to query their own job', async () => {
      const service = new JobsService(queueMock);
      const res = await service.getJobStatus('job-auth', {
        userId: 'user-owner',
        role: 'TECHNICIAN',
      } as any);
      expect(res.id).toBe('job-auth');
    });

    it('rejects non-admin querying another user job with NotFoundException (404)', async () => {
      const service = new JobsService(queueMock);
      await expect(
        service.getJobStatus('job-auth', {
          userId: 'user-other',
          role: 'TECHNICIAN',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
