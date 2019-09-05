import Mail from '../../lib/Mail';
import { format, parseISO } from 'date-fns';
import pt from 'date-fns/locale/pt';

class CancellationMail {
    get key() {
        return ' CancellationMail';
    }

    async handle({ data }) {

        const { appointement } = data;

        await Mail.sedMail({
            to: `${appointement.provider.name} <${appointement.provider.email}>`,
            subject: 'Agendamento cancelado',
            template: 'cancellation',
            context: {
                provider: appointement.provider.name,
                user: appointement.user.name,
                date: format(
                    parseISO(appointement.date),
                    "'dia' dd 'de' MMMM', às' H:mm'h'",
                    {
                        locale: pt
                    }
                )
            }
        })
    }
}

export default new CancellationMail();
