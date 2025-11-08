/**
 * Article Service - Placeholder/Stub
 * TODO: Implement full article service
 */

export interface Article {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  category?: string;
}

export class ArticleService {
  static async getArticleById(id: string): Promise<Article | null> {
    // TODO: Implement database lookup
    console.warn(`ArticleService.getArticleById(${id}) - Not yet implemented`);
    return null;
  }
}
