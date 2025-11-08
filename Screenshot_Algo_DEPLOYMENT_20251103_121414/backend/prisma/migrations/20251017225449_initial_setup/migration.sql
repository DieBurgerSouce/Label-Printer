-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "maxProducts" INTEGER NOT NULL DEFAULT 50,
    "productsFound" INTEGER NOT NULL DEFAULT 0,
    "productsScraped" INTEGER NOT NULL DEFAULT 0,
    "currentPage" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenshots" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "productName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_results" (
    "id" TEXT NOT NULL,
    "screenshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "fullText" TEXT,
    "articleNumber" TEXT,
    "price" DOUBLE PRECISION,
    "ean" TEXT,
    "productName" TEXT,
    "tieredPrices" JSONB,
    "boundingBoxes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "error" TEXT,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "ocrResultId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "articleNumber" TEXT,
    "ean" TEXT,
    "productName" TEXT,
    "price" DOUBLE PRECISION,
    "excelData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'mm',
    "dpi" INTEGER NOT NULL DEFAULT 300,
    "layers" JSONB NOT NULL,
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "imageUrl" TEXT,
    "pdfUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "tieredPrices" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "ean" TEXT,
    "category" TEXT,
    "manufacturer" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "crawlJobId" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "currentStage" TEXT,
    "totalStages" INTEGER NOT NULL DEFAULT 4,
    "progress" JSONB,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "templateId" TEXT,

    CONSTRAINT "automation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_data" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sheetName" TEXT,
    "data" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "columnCount" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "excel_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_jobs_status_idx" ON "crawl_jobs"("status");

-- CreateIndex
CREATE INDEX "crawl_jobs_createdAt_idx" ON "crawl_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "screenshots_crawlJobId_idx" ON "screenshots"("crawlJobId");

-- CreateIndex
CREATE INDEX "screenshots_createdAt_idx" ON "screenshots"("createdAt");

-- CreateIndex
CREATE INDEX "ocr_results_screenshotId_idx" ON "ocr_results"("screenshotId");

-- CreateIndex
CREATE INDEX "ocr_results_status_idx" ON "ocr_results"("status");

-- CreateIndex
CREATE INDEX "ocr_results_articleNumber_idx" ON "ocr_results"("articleNumber");

-- CreateIndex
CREATE INDEX "matches_ocrResultId_idx" ON "matches"("ocrResultId");

-- CreateIndex
CREATE INDEX "matches_articleNumber_idx" ON "matches"("articleNumber");

-- CreateIndex
CREATE INDEX "templates_name_idx" ON "templates"("name");

-- CreateIndex
CREATE INDEX "labels_templateId_idx" ON "labels"("templateId");

-- CreateIndex
CREATE INDEX "labels_status_idx" ON "labels"("status");

-- CreateIndex
CREATE INDEX "labels_createdAt_idx" ON "labels"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_articleNumber_key" ON "products"("articleNumber");

-- CreateIndex
CREATE INDEX "products_articleNumber_idx" ON "products"("articleNumber");

-- CreateIndex
CREATE INDEX "products_crawlJobId_idx" ON "products"("crawlJobId");

-- CreateIndex
CREATE INDEX "products_published_idx" ON "products"("published");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");

-- CreateIndex
CREATE INDEX "automation_jobs_status_idx" ON "automation_jobs"("status");

-- CreateIndex
CREATE INDEX "automation_jobs_createdAt_idx" ON "automation_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "excel_data_fileName_idx" ON "excel_data"("fileName");

-- CreateIndex
CREATE INDEX "excel_data_uploadedAt_idx" ON "excel_data"("uploadedAt");

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_screenshotId_fkey" FOREIGN KEY ("screenshotId") REFERENCES "screenshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_ocrResultId_fkey" FOREIGN KEY ("ocrResultId") REFERENCES "ocr_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
