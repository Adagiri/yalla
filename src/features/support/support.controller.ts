import SupportService from './support.service';
import { ContextType } from '../../types';
import { ErrorResponse } from '../../utils/responses';

class SupportController {
  static async createTicket(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      console.log(' I ran');

      if (!user) {
        throw new ErrorResponse(401, 'Unauthorized');
      }
      const ticket = await SupportService.createTicket({
        userId: user.id,
        userType: user.accountType,
        ...input,
      });

      return ticket;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Failed to create ticket', error.message);
    }
  }

  static async getMyTickets(
    _: any,
    { page, limit }: { page?: number; limit?: number },
    { user }: ContextType
  ) {
    try {
      if (!user) {
        throw new ErrorResponse(401, 'Unauthorized');
      }

      return await SupportService.getTickets({
        userId: user.id,
        page,
        limit,
      });
    } catch (error: any) {
      throw new ErrorResponse(500, 'Failed to fetch tickets', error.message);
    }
  }

  static async getAllTickets(_: any, { filters }: { filters?: any }) {
    try {
      return await SupportService.getTickets(filters || {});
    } catch (error: any) {
      throw new ErrorResponse(500, 'Failed to fetch tickets', error.message);
    }
  }

  static async getTicket(_: any, { id }: { id: string }) {
    try {
      return await SupportService.getTicketById(id);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Failed to fetch ticket', error.message);
    }
  }

  static async addMessage(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      if (!user) {
        throw new ErrorResponse(401, 'Unauthorized');
      }

      return await SupportService.addMessage({
        ticketId: input.ticketId,
        senderId: user.id,
        senderType: user.accountType,
        message: input.message,
      });
    } catch (error: any) {
      throw new ErrorResponse(500, 'Failed to add message', error.message);
    }
  }

  static async updateTicket(_: any, { input }: { input: any }) {
    try {
      return await SupportService.updateTicket(input);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Failed to update ticket', error.message);
    }
  }

  static async getTicketStats() {
    try {
      return await SupportService.getTicketStats();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Failed to fetch stats', error.message);
    }
  }
}

export default SupportController;
