// src/services/note.service.ts
// Contact notes management

import { PrismaClient, Note } from '@prisma/client';
import logger from '@utils/logger';
import { NotFoundError } from '@utils/errors';

export interface CreateNoteData {
  contactId: string;
  content: string;
}

export interface UpdateNoteData {
  content?: string;
}

export interface INoteService {
  createNote(userId: string, data: CreateNoteData): Promise<Note>;
  getNotes(contactId: string): Promise<Note[]>;
  updateNote(noteId: string, data: UpdateNoteData): Promise<Note>;
  deleteNote(noteId: string): Promise<void>;
}

export class NoteService implements INoteService {
  constructor(private prisma: PrismaClient) {}

  async createNote(userId: string, data: CreateNoteData): Promise<Note> {
    // Verify contact exists and belongs to user
    const contact = await this.prisma.contact.findFirst({
      where: { id: data.contactId, userId },
    });

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    const note = await this.prisma.note.create({
      data: {
        userId,
        contactId: data.contactId,
        content: data.content,
      },
    });

    logger.info({ noteId: note.id, contactId: data.contactId }, 'Note created');
    return note;
  }

  async getNotes(contactId: string): Promise<Note[]> {
    return this.prisma.note.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async updateNote(noteId: string, data: UpdateNoteData): Promise<Note> {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });

    if (!note) {
      throw new NotFoundError('Note not found');
    }

    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        content: data.content,
      },
    });

    logger.info({ noteId }, 'Note updated');
    return updated;
  }

  async deleteNote(noteId: string): Promise<void> {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });

    if (!note) {
      throw new NotFoundError('Note not found');
    }

    await this.prisma.note.delete({ where: { id: noteId } });
    logger.info({ noteId }, 'Note deleted');
  }
}
