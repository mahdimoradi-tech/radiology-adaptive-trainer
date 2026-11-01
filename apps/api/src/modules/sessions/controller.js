import { HttpError } from '../../lib/httpErrors.js';
import { sessionService } from './service.js';

export function createSessionController(config) {
  return {
    async createSession(req, res) {
      const { size } = req.valid.body;
      const session = await sessionService.createSession({
        userId: req.user._id,
        size,
        allowRepeats: config.ALLOW_REPEATS,
      });
      res.status(201).json({ data: session });
    },

    async getSessions(req, res) {
      const { page, pageSize } = req.valid.query;
      const result = await sessionService.getSessions({
        userId: req.user._id,
        page,
        pageSize,
      });
      res.status(200).json({ data: result.items, meta: result.meta });
    },

    async getSessionById(req, res) {
      const session = await sessionService.getSessionById({
        userId: req.user._id,
        sessionId: req.params.id,
      });
      res.status(200).json({ data: session });
    },

    async answerQuestion(req, res) {
      const questionNo = Number.parseInt(req.params.no, 10);
      if (Number.isNaN(questionNo) || questionNo < 1) {
        throw new HttpError(404, 'QUESTION_NOT_FOUND', 'Question not found');
      }

      const { answer, timeMs } = req.valid.body;
      const result = await sessionService.answerQuestion({
        userId: req.user._id,
        sessionId: req.params.id,
        questionNo,
        answer,
        timeMs,
      });
      res.status(200).json({ data: result });
    },

    async finishSession(req, res) {
      const report = await sessionService.finishSession({
        userId: req.user._id,
        sessionId: req.params.id,
      });
      res.status(200).json({ data: report });
    },

    async getSessionReport(req, res) {
      const report = await sessionService.getSessionReport({
        userId: req.user._id,
        sessionId: req.params.id,
        isInstructor: false,
      });
      res.status(200).json({ data: report });
    },

    async getProgress(req, res) {
      const progress = await sessionService.getProgress(req.user._id);
      res.status(200).json({ data: progress });
    },

    async getAdminUsers(req, res) {
      const { page, pageSize } = req.valid.query;
      const result = await sessionService.getAdminResidents({ page, pageSize });
      res.status(200).json({ data: result.items, meta: result.meta });
    },

    async getAdminUserProgress(req, res) {
      const progress = await sessionService.getProgress(req.params.userId);
      res.status(200).json({ data: progress });
    },

    async getAdminSessionReport(req, res) {
      const report = await sessionService.getSessionReport({
        sessionId: req.params.id,
        isInstructor: true,
      });
      res.status(200).json({ data: report });
    },
  };
}
