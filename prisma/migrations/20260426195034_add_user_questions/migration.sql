-- CreateTable
CREATE TABLE "user_questions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "asked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_questions_user_id_idx" ON "user_questions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_questions_user_id_question_key_key" ON "user_questions"("user_id", "question_key");

-- AddForeignKey
ALTER TABLE "user_questions" ADD CONSTRAINT "user_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
