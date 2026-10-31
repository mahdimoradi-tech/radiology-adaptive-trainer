import { getCatalogStats, getCatalogImages } from './service.js';

export const catalogController = {
  async getStats(_req, res) {
    const stats = await getCatalogStats();
    res.status(200).json({ data: stats });
  },

  async getImages(req, res) {
    const result = await getCatalogImages(req.valid.query);
    res.status(200).json({ data: result.items, meta: result.meta });
  },
};
