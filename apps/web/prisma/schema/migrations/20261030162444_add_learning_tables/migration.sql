-- CreateEnum
CREATE TYPE "turn_outcome" AS ENUM ('answered', 'needed_help', 'skipped');

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "explanation" TEXT NOT NULL,
    "concept_results" JSONB NOT NULL,
    "reactions" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_turns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "outcome" "turn_outcome",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gaps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "concept" JSONB NOT NULL,
    "right_streak" INTEGER NOT NULL DEFAULT 0,
    "next_due_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warm_ups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gap_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "is_right" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warm_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "students_user_id_idx" ON "students"("user_id");

-- CreateIndex
CREATE INDEX "classes_topic_id_idx" ON "classes"("topic_id");

-- CreateIndex
CREATE INDEX "class_turns_class_id_idx" ON "class_turns"("class_id");

-- CreateIndex
CREATE INDEX "class_turns_student_id_idx" ON "class_turns"("student_id");

-- CreateIndex
CREATE INDEX "gaps_user_id_next_due_at_idx" ON "gaps"("user_id", "next_due_at");

-- CreateIndex
CREATE INDEX "gaps_topic_id_idx" ON "gaps"("topic_id");

-- CreateIndex
CREATE INDEX "warm_ups_gap_id_idx" ON "warm_ups"("gap_id");

-- CreateIndex
CREATE INDEX "warm_ups_student_id_idx" ON "warm_ups"("student_id");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "class_turns" ADD CONSTRAINT "class_turns_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "class_turns" ADD CONSTRAINT "class_turns_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gaps" ADD CONSTRAINT "gaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gaps" ADD CONSTRAINT "gaps_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warm_ups" ADD CONSTRAINT "warm_ups_gap_id_fkey" FOREIGN KEY ("gap_id") REFERENCES "gaps"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warm_ups" ADD CONSTRAINT "warm_ups_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
