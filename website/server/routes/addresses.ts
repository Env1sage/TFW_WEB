import { Router, Request, Response } from 'express';
import { pool } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

function rowToAddr(r: any) {
  return {
    id: r.id, label: r.label, fullName: r.full_name, phone: r.phone, email: r.email,
    addressLine1: r.address_line1, addressLine2: r.address_line2,
    city: r.city, state: r.state, pincode: r.pincode,
    isDefault: r.is_default, createdAt: r.created_at,
  };
}

// GET /api/addresses
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { rows } = await pool.query(
      `SELECT * FROM website_user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [userId],
    );
    res.json(rows.map(rowToAddr));
  } catch { res.status(500).json({ error: 'Failed to fetch addresses' }); }
});

// POST /api/addresses
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { label, fullName, phone, email, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body;
    if (!addressLine1 || !city || !state || !pincode) return res.status(400).json({ error: 'addressLine1, city, state, pincode required' });

    if (isDefault) {
      await pool.query(`UPDATE website_user_addresses SET is_default = false WHERE user_id = $1`, [userId]);
    }

    const { rows } = await pool.query(
      `INSERT INTO website_user_addresses
         (id, user_id, label, full_name, phone, email, address_line1, address_line2, city, state, pincode, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [uuid(), userId, label || '', fullName || '', phone || '', email || '',
       addressLine1, addressLine2 || '', city, state, pincode, isDefault ?? false],
    );
    res.status(201).json(rowToAddr(rows[0]));
  } catch { res.status(500).json({ error: 'Failed to save address' }); }
});

// PUT /api/addresses/:id
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { label, fullName, phone, email, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body;

    if (isDefault) {
      await pool.query(`UPDATE website_user_addresses SET is_default = false WHERE user_id = $1`, [userId]);
    }

    const { rows } = await pool.query(
      `UPDATE website_user_addresses SET
         label=$1, full_name=$2, phone=$3, email=$4, address_line1=$5,
         address_line2=$6, city=$7, state=$8, pincode=$9, is_default=$10
       WHERE id=$11 AND user_id=$12 RETURNING *`,
      [label || '', fullName || '', phone || '', email || '', addressLine1 || '',
       addressLine2 || '', city || '', state || '', pincode || '', isDefault ?? false,
       req.params.id, userId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Address not found' });
    res.json(rowToAddr(rows[0]));
  } catch { res.status(500).json({ error: 'Failed to update address' }); }
});

// DELETE /api/addresses/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    await pool.query(`DELETE FROM website_user_addresses WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to delete address' }); }
});

export default router;
