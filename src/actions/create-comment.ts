'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/db';
import paths from '@/paths';

const createCommentSchema = z.object({
    content: z.string().min(3),
});

interface CreateCommentFormState {
    content?: string[];
    _general?: string[];
    success?: boolean;
}

export async function createComment(
    { postId, parentId }: { postId: string; parentId?: string },
    formState: CreateCommentFormState,
    formData: FormData
): Promise<CreateCommentFormState> {
    const result = createCommentSchema.safeParse({
        content: formData.get('content'),
    });

    if (!result.success) {
        return result.error.flatten().fieldErrors
    }

    const session = await auth();
    if (!session || !session.user) {
        return {
            _general: ['You must sign in to do this.']
        };
    }

    try {
        await db.comment.create({
            data: {
                content: result.data.content,
                postId: postId,
                parentId: parentId,
                userId: session.user.id,
            },
        });
    } catch (err) {
        if (err instanceof Error) {
            return {
                _general: [err.message],
            };
        }
        return {
            _general: ['Something went wrong...'],
        };
    }

    const topic = await db.topic.findFirst({
        where: { posts: { some: { id: postId } } },
    });

    if (!topic) {
        return {
            _general: ['Failed to revalidate topic'],
        };
    }

    revalidatePath(paths.postShow(topic.slug, postId));
    return { success: true };
}
