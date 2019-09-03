import User from '../models/User';
import File from '../models/File';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns//locale/pt'
import Appointment from '../models/Appointment';
import Notification from '../schemas/notification';
import Mail from '../../lib/Mail';

import * as Yup from 'yup';

class AppointmentController {

    async index(req, res) {
        const { page = 1 } = req.query;

        const appointements = await Appointment.findAll({
            where: {
                user_id: req.userId,
                canceled_at: null
            },
            attributes: ['id', 'date'],
            limit: 20,
            offset: (page - 1) * 20,
            order: [
                'date'
            ],
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'provider'],
                    include: [{
                        model: File,
                        as: 'avatar',
                        attributes: [
                            'id',
                            'path',
                            'url'
                        ]
                    }]
                }
            ]
        });

        return res.json(appointements)
    }

    async store(req, res) {
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            date: Yup.date().required()
        });

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ error: 'Validation fails' });
        }

        const { provider_id, date } = req.body;

        /**
         * Check if appointment at provider with same provider
         */
        if (provider_id === req.userId) {
            return res.status(401).json({ error: 'You can only create appointements with another providers' });
        }


        /**
         * Check if provider_id is a provider
         */
        const isProvider = await User.findOne({
            where: { id: provider_id, provider: true },
        })

        if (!isProvider) {
            return res.status(401).json({ error: 'You can only create appointements with providers' });
        }

        const hourStart = startOfHour(parseISO(date));

        /**
         * Check for past dates
         */
        if (isBefore(hourStart, new Date())) {
            return res.status(400).json({ error: 'Past dates are not permited' });
        }

        /**
         * Check date availability
         */
        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourStart
            }
        });

        if (checkAvailability) {
            return res.status(400).json({ error: 'Appointment date is not available' });
        }

        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            date
        });

        /**
         * Notify appointment provider
         */

        const user = await User.findByPk(req.userId);
        const formattedDate = format(
            hourStart,
            "'dia' dd 'de' MMMM', às' H:mm'h'",
            {
                locale: pt
            }
        );

        await Notification.create({
            content: `Novo agendamento de ${user.name} para ${formattedDate}`,
            user: provider_id,
        })

        return res.json(appointment);
    }

    async delete(req, res) {
        const appointement = await Appointment.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'email']
                }
            ]
        });

        console.log(appointement)

        if (appointement.user_id !== req.userId) {
            return res.status(401).json({
                error: "You don't have perission to cancel this appointment"
            })
        }

        const dateWithSub = subHours(appointement.date, 2);

        if (isBefore(dateWithSub, new Date())) {
            return res.status(401).json({
                error: 'You can only cancel appointments 2 hours in advance.'
            })
        }

        appointement.canceled_at = new Date();

        await appointement.save();

        await Mail.sedMail({
            to: `${appointement.provider.name} <${appointement.provider.email}>` ,
            subject: 'Agendamento cancelado',
            text: 'Você tem um novo cancelamento'
        })


        return res.json(appointement);
    }
}

export default new AppointmentController();
