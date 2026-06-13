declare const templates: {
    capaCreated: (data: {
        capaNumber: string;
        auditNumber: string;
        finding: string;
        assigneeName: string;
        dueDate: string;
        link: string;
    }) => {
        subject: string;
        html: string;
    };
    capaDueSoon: (data: {
        capaNumber: string;
        finding: string;
        dueDate: string;
        daysLeft: number;
        link: string;
    }) => {
        subject: string;
        html: string;
    };
    capaOverdue: (data: {
        capaNumber: string;
        finding: string;
        dueDate: string;
        daysOverdue: number;
        link: string;
    }) => {
        subject: string;
        html: string;
    };
    capaCompleted: (data: {
        capaNumber: string;
        finding: string;
        completedBy: string;
        completedDate: string;
        link: string;
    }) => {
        subject: string;
        html: string;
    };
    passwordReset: (data: {
        name: string;
        resetUrl: string;
    }) => {
        subject: string;
        html: string;
    };
};
export declare const emailService: {
    sendEmail(to: string, subject: string, html: string): Promise<boolean>;
    sendCapaCreated(to: string, data: Parameters<typeof templates.capaCreated>[0]): Promise<boolean>;
    sendCapaDueSoon(to: string, data: Parameters<typeof templates.capaDueSoon>[0]): Promise<boolean>;
    sendCapaOverdue(to: string, data: Parameters<typeof templates.capaOverdue>[0]): Promise<boolean>;
    sendCapaCompleted(to: string, data: Parameters<typeof templates.capaCompleted>[0]): Promise<boolean>;
    sendPasswordReset(to: string, data: Parameters<typeof templates.passwordReset>[0]): Promise<boolean>;
    verifyConnection(): Promise<boolean>;
};
export default emailService;
//# sourceMappingURL=email.service.d.ts.map