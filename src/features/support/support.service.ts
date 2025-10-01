import SupportTicket, { SupportTicketDocument } from './support.model';
import { ErrorResponse } from '../../utils/responses';
import { AccountType } from '../../constants/general';

interface CreateTicketInput {
  userId: string;
  userType: 'CUSTOMER' | 'DRIVER';
  subject: string;
  description: string;
  category: 'PAYMENT' | 'TRIP' | 'ACCOUNT' | 'TECHNICAL' | 'OTHER';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  attachments?: string[];
}

interface AddMessageInput {
  ticketId: string;
  senderId: string;
  senderType: AccountType;
  message: string;
}

interface UpdateTicketInput {
  ticketId: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
}

class SupportService {
  static async createTicket(input: CreateTicketInput) {
    try {
      const ticket = await SupportTicket.create({
        ...input,
        messages: [
          {
            senderId: input.userId,
            senderType: input.userType,
            message: input.description,
            createdAt: new Date(),
          },
        ],
      });

      return ticket;
    } catch (error: any) {
        console.log(error, 'error')
      throw new ErrorResponse(500, 'Failed to create ticket', error.message);
    }
  }

  static async getTickets(filters: {
    userId?: string;
    userType?: string;
    status?: string;
    category?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      userType,
      status,
      category,
      assignedTo,
      page = 1,
      limit = 20,
    } = filters;

    const query: any = {};
    if (userId) query.userId = userId;
    if (userType) query.userType = userType;
    if (status) query.status = status;
    if (category) query.category = category;
    if (assignedTo) query.assignedTo = assignedTo;

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    return {
      tickets: tickets.map((t) => ({ ...t, id: t._id })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getTicketById(ticketId: string) {
    const ticket = await SupportTicket.findById(ticketId).lean();
    if (!ticket) {
      throw new ErrorResponse(404, 'Ticket not found');
    }
    return { ...ticket, id: ticket._id };
  }

  static async addMessage(input: AddMessageInput) {
    const { ticketId, senderId, senderType, message } = input;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new ErrorResponse(404, 'Ticket not found');
    }

    ticket.messages.push({
      senderId,
      senderType,
      message,
      createdAt: new Date(),
    } as any);

    await ticket.save();
    return { ...ticket.toObject(), id: ticket._id };
  }

  static async updateTicket(input: UpdateTicketInput) {
    const { ticketId, status, priority, assignedTo } = input;

    const updates: any = {};
    if (status) {
      updates.status = status;
      if (status === 'RESOLVED') updates.resolvedAt = new Date();
      if (status === 'CLOSED') updates.closedAt = new Date();
    }
    if (priority) updates.priority = priority;
    if (assignedTo) updates.assignedTo = assignedTo;

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      { $set: updates },
      { new: true }
    ).lean();

    if (!ticket) {
      throw new ErrorResponse(404, 'Ticket not found');
    }

    return { ...ticket, id: ticket._id };
  }

  static async getTicketStats() {
    const [total, open, inProgress, resolved, closed] = await Promise.all([
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ status: 'OPEN' }),
      SupportTicket.countDocuments({ status: 'IN_PROGRESS' }),
      SupportTicket.countDocuments({ status: 'RESOLVED' }),
      SupportTicket.countDocuments({ status: 'CLOSED' }),
    ]);

    return {
      total,
      open,
      inProgress,
      resolved,
      closed,
    };
  }
}

export default SupportService;
