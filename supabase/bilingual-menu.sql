-- Homelody bilingual menu. Run once in Supabase SQL Editor, then reload admin.
-- Adds optional text columns; existing prices, images, permissions and Vietnamese copy stay intact.
-- Safe to rerun: populated English fields are not overwritten.
begin;
alter table public.drinks
  add column if not exists name_en text not null default '',
  add column if not exists description_en text not null default '',
  add column if not exists note_en text not null default '',
  add column if not exists ingredients_en text[] not null default '{}',
  add column if not exists image_alt_en text not null default '';

update public.drinks set
  name_en = case when name_en = '' then 'Vietnamese Black Coffee' else name_en end,
  description_en = case when description_en = '' then 'Bold Vietnamese coffee with a rich roasted aroma, for those who love coffee in its simplest form.' else description_en end,
  note_en = case when note_en = '' then 'Bold · Bitter · Roasted finish' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Vietnamese Black Coffee' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coffee', 'Water', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '6285f413-b962-4e02-9cab-6ee439d8b9ed' and name = 'Cà phê đen';

update public.drinks set
  name_en = case when name_en = '' then 'Vietnamese Milk Coffee' else name_en end,
  description_en = case when description_en = '' then 'Rich Vietnamese coffee with sweet condensed milk, a familiar companion for a slow morning.' else description_en end,
  note_en = case when note_en = '' then 'Rich coffee · Sweet & creamy · Balanced' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Vietnamese Milk Coffee' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coffee', 'Condensed milk', 'Ice']::text[] else ingredients_en end
where id = 'ae94ca2e-d499-460b-919e-4e3c90289cec' and name = 'Cà phê sữa';

update public.drinks set
  name_en = case when name_en = '' then 'Bac Xiu — Milky Coffee' else name_en end,
  description_en = case when description_en = '' then 'Sweet, creamy milk with a gentle touch of coffee.' else description_en end,
  note_en = case when note_en = '' then 'Milky · Gently sweet · Light coffee' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Bac Xiu — Milky Coffee' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coffee', 'Condensed milk', 'Fresh milk', 'Ice']::text[] else ingredients_en end
where id = '04be0f65-2625-48f4-803d-f5666ea7e3ab' and name = 'Bạc xỉu';

update public.drinks set
  name_en = case when name_en = '' then 'Salt Coffee' else name_en end,
  description_en = case when description_en = '' then 'Rich coffee topped with silky salted cream, balancing sweetness with a hint of salt.' else description_en end,
  note_en = case when note_en = '' then 'Aromatic · Silky · Lightly salted' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Salt Coffee' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coffee', 'Condensed milk', 'Milk cream', 'Salt', 'Ice']::text[] else ingredients_en end
where id = '62d576d7-e2d8-4af9-a691-9304463524ad' and name = 'Cà phê muối';

update public.drinks set
  name_en = case when name_en = '' then 'Coconut Coffee' else name_en end,
  description_en = case when description_en = '' then 'Bold coffee meets mellow coconut for a cool, comforting drink.' else description_en end,
  note_en = case when note_en = '' then 'Coconut · Creamy · Rich coffee' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Coconut Coffee' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coffee', 'Coconut milk', 'Condensed milk', 'Ice']::text[] else ingredients_en end
where id = 'ebfeb9db-d738-42ce-a58f-a18e5068fc1a' and name = 'Cà phê dừa';

update public.drinks set
  name_en = case when name_en = '' then 'Egg Coffee' else name_en end,
  description_en = case when description_en = '' then 'Rich coffee beneath a soft, velvety egg cream, gently sweet and indulgent.' else description_en end,
  note_en = case when note_en = '' then 'Rich egg cream · Velvety · Aromatic' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Egg Coffee' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coffee', 'Egg yolk', 'Condensed milk', 'Sugar']::text[] else ingredients_en end
where id = '6e875ba9-9f74-42c8-ae04-440afe0662ad' and name = 'Cà phê kem trứng';

update public.drinks set
  name_en = case when name_en = '' then 'Tiramisu Coffee' else name_en end,
  description_en = case when description_en = '' then 'Coffee with tiramisu-inspired cream, a cocoa aroma and a silky finish.' else description_en end,
  note_en = case when note_en = '' then 'Cocoa · Creamy · Rich coffee' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Tiramisu Coffee' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coffee', 'Milk', 'Tiramisu cream', 'Cocoa powder', 'Ice']::text[] else ingredients_en end
where id = '56149aa2-b4ac-45c0-bdcf-33e71f85de2c' and name = 'Cà phê Tiramisu';

update public.drinks set
  name_en = case when name_en = '' then 'Espresso' else name_en end,
  description_en = case when description_en = '' then 'A concentrated espresso with a distinct roasted aroma and a lingering finish.' else description_en end,
  note_en = case when note_en = '' then 'Concentrated · Bold · Long finish' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Espresso' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Espresso']::text[] else ingredients_en end
where id = 'fd287b52-f70f-4bc9-8487-11a1f9c07f24' and name = 'Espresso';

update public.drinks set
  name_en = case when name_en = '' then 'Americano' else name_en end,
  description_en = case when description_en = '' then 'Espresso with water for a lighter cup that keeps its roasted character.' else description_en end,
  note_en = case when note_en = '' then 'Roasted · Light · Gently bitter' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Americano' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Espresso', 'Water', 'Ice']::text[] else ingredients_en end
where id = '2c9d73dc-3a9e-4991-bed7-989554696434' and name = 'Americano';

update public.drinks set
  name_en = case when name_en = '' then 'Latte' else name_en end,
  description_en = case when description_en = '' then 'Espresso meets smooth milk for a mellow, naturally creamy cup.' else description_en end,
  note_en = case when note_en = '' then 'Smooth · Milky · Mellow coffee' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Latte' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Espresso', 'Fresh milk', 'Milk foam']::text[] else ingredients_en end
where id = 'b50e5051-cd0d-43d0-a655-26b873486d09' and name = 'Latte';

update public.drinks set
  name_en = case when name_en = '' then 'Matcha Latte' else name_en end,
  description_en = case when description_en = '' then 'Matcha with creamy milk, retaining its green-tea aroma and gentle bitterness.' else description_en end,
  note_en = case when note_en = '' then 'Green tea · Creamy · Gently bitter' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Matcha Latte' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Matcha powder', 'Fresh milk', 'Sugar']::text[] else ingredients_en end
where id = '7a765812-5a31-4cf1-976d-58c36993df0c' and name = 'Matcha Latte';

update public.drinks set
  name_en = case when name_en = '' then 'Chocolate Latte' else name_en end,
  description_en = case when description_en = '' then 'Rich chocolate and smooth milk, comforting and gently sweet.' else description_en end,
  note_en = case when note_en = '' then 'Rich chocolate · Milky · Gently sweet' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Chocolate Latte' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Chocolate', 'Fresh milk', 'Sugar']::text[] else ingredients_en end
where id = 'e1ec2111-a927-4df4-9393-fd651100cfb5' and name = 'Chocolate Latte';

update public.drinks set
  name_en = case when name_en = '' then 'Caramel Macchiato' else name_en end,
  description_en = case when description_en = '' then 'Coffee and milk with fragrant caramel and a gentle coffee finish.' else description_en end,
  note_en = case when note_en = '' then 'Caramel · Sweet & creamy · Mellow coffee' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Caramel Macchiato' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Espresso', 'Fresh milk', 'Caramel sauce', 'Ice']::text[] else ingredients_en end
where id = '323ffb5a-4ae8-4e24-8728-aeb97755646f' and name = 'Caramel Macchiato';

update public.drinks set
  name_en = case when name_en = '' then 'Cappuccino' else name_en end,
  description_en = case when description_en = '' then 'Espresso, milk and fine foam in a balance of bold coffee and light creaminess.' else description_en end,
  note_en = case when note_en = '' then 'Balanced · Fine milk foam · Lightly creamy' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Cappuccino' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Espresso', 'Fresh milk', 'Milk foam', 'Cocoa powder']::text[] else ingredients_en end
where id = '39957433-3ad3-4544-bccb-360bd4ff9c0b' and name = 'Cappuccino';

update public.drinks set
  name_en = case when name_en = '' then 'Pineapple, Watermelon & Passion Fruit' else name_en end,
  description_en = case when description_en = '' then 'Fragrant pineapple, refreshing watermelon and aromatic passion fruit in a bright fruit blend.' else description_en end,
  note_en = case when note_en = '' then 'Refreshing · Tangy · Tropical' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Pineapple, Watermelon & Passion Fruit' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Pineapple', 'Watermelon', 'Passion fruit', 'Ice']::text[] else ingredients_en end
where id = '51a47664-bbd9-4168-babb-fd9d69daae12' and name = 'Dứa - Dưa hấu - Chanh dây';

update public.drinks set
  name_en = case when name_en = '' then 'Pineapple, Passion Fruit & Mint' else name_en end,
  description_en = case when description_en = '' then 'Sweet-tart pineapple and passion fruit with a refreshing touch of mint.' else description_en end,
  note_en = case when note_en = '' then 'Sweet-tart · Minty · Cooling' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Pineapple, Passion Fruit & Mint' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Pineapple', 'Passion fruit', 'Mint', 'Ice']::text[] else ingredients_en end
where id = '3598273d-d9b1-4e81-a13c-c0b59c854f59' and name = 'Dứa - Chanh dây - Bạc hà';

update public.drinks set
  name_en = case when name_en = '' then 'Pineapple, Orange & Lime' else name_en end,
  description_en = case when description_en = '' then 'Pineapple, orange and lime combine in a bright, sweet-tart fruit blend.' else description_en end,
  note_en = case when note_en = '' then 'Tangy · Gently sweet · Citrus & pineapple' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Pineapple, Orange & Lime' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Pineapple', 'Orange', 'Lime', 'Ice']::text[] else ingredients_en end
where id = '2930e9d1-0ef4-4556-a9b4-f52e4b379c8f' and name = 'Dứa - Cam - Chanh';

update public.drinks set
  name_en = case when name_en = '' then 'Lime Juice' else name_en end,
  description_en = case when description_en = '' then 'Bright lime with a gentle citrus aroma, refreshing on a sunny day.' else description_en end,
  note_en = case when note_en = '' then 'Tangy · Citrusy · Refreshing' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Lime Juice' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Lime', 'Water', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '0c165950-f1b9-49b5-83d3-922700aee06b' and name = 'Chanh';

update public.drinks set
  name_en = case when name_en = '' then 'Pineapple Juice' else name_en end,
  description_en = case when description_en = '' then 'Ripe pineapple with a sweet aroma and a gentle tropical tang.' else description_en end,
  note_en = case when note_en = '' then 'Pineapple · Gently sweet · Lightly tart' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Pineapple Juice' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Pineapple', 'Ice']::text[] else ingredients_en end
where id = 'f2d50220-5087-45e1-8e92-7d6847681d0d' and name = 'Dứa';

update public.drinks set
  name_en = case when name_en = '' then 'Watermelon Juice' else name_en end,
  description_en = case when description_en = '' then 'Light, sweet and refreshing watermelon, made for a sunny afternoon.' else description_en end,
  note_en = case when note_en = '' then 'Refreshing · Light · Mellow' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Watermelon Juice' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Watermelon', 'Ice']::text[] else ingredients_en end
where id = '2a9d3018-2344-4699-b479-8e3663147564' and name = 'Dưa hấu';

update public.drinks set
  name_en = case when name_en = '' then 'Passion Fruit Juice' else name_en end,
  description_en = case when description_en = '' then 'Aromatic passion fruit with a bright, sweet-tart tropical flavour.' else description_en end,
  note_en = case when note_en = '' then 'Sweet-tart · Aromatic · Bright' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Passion Fruit Juice' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Passion fruit', 'Water', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '89d1a143-4cbf-4c13-9525-baba576f4314' and name = 'Chanh dây';

update public.drinks set
  name_en = case when name_en = '' then 'Orange Juice' else name_en end,
  description_en = case when description_en = '' then 'Balanced sweet-tart orange juice, easy to enjoy at any time of day.' else description_en end,
  note_en = case when note_en = '' then 'Orange · Gently tart · Lightly sweet' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Orange Juice' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Orange']::text[] else ingredients_en end
where id = '2c6eda00-10ff-45c6-931a-b08c69cd71e3' and name = 'Cam ép';

update public.drinks set
  name_en = case when name_en = '' then 'Coconut Water' else name_en end,
  description_en = case when description_en = '' then 'Naturally refreshing coconut water with a light, gentle sweetness.' else description_en end,
  note_en = case when note_en = '' then 'Lightly sweet · Refreshing · Coconut' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Coconut Water' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coconut water', 'Coconut flesh', 'Ice']::text[] else ingredients_en end
where id = '1dd99771-d4a8-4bf3-9625-51c1fcf36012' and name = 'Nước dừa';

update public.drinks set
  name_en = case when name_en = '' then 'Coconut & Kumquat' else name_en end,
  description_en = case when description_en = '' then 'Lightly sweet coconut water with a fragrant, gently tart kumquat twist.' else description_en end,
  note_en = case when note_en = '' then 'Lightly sweet · Gently tart · Kumquat' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Coconut & Kumquat' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coconut water', 'Kumquat', 'Coconut flesh', 'Ice']::text[] else ingredients_en end
where id = '5a2844f2-be9a-4df4-bd59-b37e42348a95' and name = 'Dừa Tắc';

update public.drinks set
  name_en = case when name_en = '' then 'Coconut with Cheese Cream' else name_en end,
  description_en = case when description_en = '' then 'Refreshing coconut water beneath a soft, rich cheese-cream topping.' else description_en end,
  note_en = case when note_en = '' then 'Coconut · Creamy · Lightly salted' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Coconut with Cheese Cream' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coconut water', 'Cheese cream', 'Ice']::text[] else ingredients_en end
where id = 'd8890033-4c75-4b9f-b37b-2e6326fac40d' and name = 'Dừa - Kem Cheese';

update public.drinks set
  name_en = case when name_en = '' then 'Coconut Latte' else name_en end,
  description_en = case when description_en = '' then 'Coconut and coffee come together in a mellow, aromatic drink.' else description_en end,
  note_en = case when note_en = '' then 'Coconut · Coffee · Mellow' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Coconut Latte' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coconut water', 'Espresso', 'Milk', 'Ice']::text[] else ingredients_en end
where id = 'c905c9c5-7450-4254-9d25-889b0b1a4361' and name = 'Dừa Latte';

update public.drinks set
  name_en = case when name_en = '' then 'Coconut Matcha' else name_en end,
  description_en = case when description_en = '' then 'Gently sweet coconut and aromatic matcha with a soft green-tea bitterness.' else description_en end,
  note_en = case when note_en = '' then 'Green tea · Coconut · Gently bitter' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Coconut Matcha' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Coconut water', 'Matcha powder', 'Milk', 'Ice']::text[] else ingredients_en end
where id = 'e7277579-dd13-45a8-9790-a48f3e0c1562' and name = 'Dừa - Matcha';

update public.drinks set
  name_en = case when name_en = '' then 'Mint Tea' else name_en end,
  description_en = case when description_en = '' then 'Fragrant mint tea with a light, cooling finish.' else description_en end,
  note_en = case when note_en = '' then 'Minty · Cooling · Mellow' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Mint Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Mint tea', 'Lime', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = 'da33c16e-97f1-4bdc-9fbe-583b91b04402' and name = 'Trà bạc hà';

update public.drinks set
  name_en = case when name_en = '' then 'Ginger Tea' else name_en end,
  description_en = case when description_en = '' then 'Warm, fragrant ginger tea with a gentle spice, perfect for taking your time.' else description_en end,
  note_en = case when note_en = '' then 'Warming · Gently spicy · Ginger' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Ginger Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Ginger', 'Hot water', 'Sugar']::text[] else ingredients_en end
where id = 'f90fd8db-cdc7-4f6a-bf03-f881ba2d06a0' and name = 'Trà gừng';

update public.drinks set
  name_en = case when name_en = '' then 'Peach, Orange & Lemongrass Tea' else name_en end,
  description_en = case when description_en = '' then 'Sweet peach tea with mellow orange and a delicate lemongrass aroma.' else description_en end,
  note_en = case when note_en = '' then 'Refreshing · Gently tart · Herbal' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Peach, Orange & Lemongrass Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tea', 'Peach', 'Orange', 'Lemongrass', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '48877553-ae63-4809-ad4a-5de43a83f8b1' and name = 'Trà đào cam sả';

update public.drinks set
  name_en = case when name_en = '' then 'Pink Guava & Preserved Fruit Tea' else name_en end,
  description_en = case when description_en = '' then 'Soft guava tea with a hint of tart, salted preserved fruit to balance the sweetness.' else description_en end,
  note_en = case when note_en = '' then 'Guava · Sweet-tart · Lightly salted' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Pink Guava & Preserved Fruit Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tea', 'Pink guava', 'Salted preserved fruit', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '56c3a555-67d2-4853-a0c5-723f9d0f556b' and name = 'Trà ổi hồng ô mai';

update public.drinks set
  name_en = case when name_en = '' then 'Kumquat, Tamarind & Palm Seed Tea' else name_en end,
  description_en = case when description_en = '' then 'Sweet-tart kumquat and tamarind tea with lightly crunchy palm seeds.' else description_en end,
  note_en = case when note_en = '' then 'Sweet-tart · Citrus & tamarind · Light crunch' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Kumquat, Tamarind & Palm Seed Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tea', 'Kumquat', 'Tamarind', 'Palm seeds', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = 'bb6dbe6e-d71a-4989-9b8d-fc8581f98d60' and name = 'Trà tắc me hạt đác';

update public.drinks set
  name_en = case when name_en = '' then 'Lychee & Rose Tea' else name_en end,
  description_en = case when description_en = '' then 'Gentle lychee sweetness and a delicate rose aroma in a light tea.' else description_en end,
  note_en = case when note_en = '' then 'Lychee · Floral · Mellow' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Lychee & Rose Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tea', 'Lychee', 'Rose syrup', 'Ice']::text[] else ingredients_en end
where id = 'acdcbfd2-2fcf-47e9-bf8a-b98c0564afef' and name = 'Trà vải hoa hồng';

update public.drinks set
  name_en = case when name_en = '' then 'Plum, Peach & Aloe Vera Tea' else name_en end,
  description_en = case when description_en = '' then 'Sweet-tart plum and peach tea with cool, crisp aloe vera.' else description_en end,
  note_en = case when note_en = '' then 'Sweet-tart · Fruity · Crisp' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Plum, Peach & Aloe Vera Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tea', 'Plum', 'Peach', 'Aloe vera', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '65317a92-fd52-4aee-8aa3-b26b95fb7d4f' and name = 'Trà mận đào nha đam';

update public.drinks set
  name_en = case when name_en = '' then 'Oolong Milk Tea' else name_en end,
  description_en = case when description_en = '' then 'Fragrant oolong with creamy milk and a soft tea finish.' else description_en end,
  note_en = case when note_en = '' then 'Oolong · Creamy · Tea finish' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Oolong Milk Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Oolong tea', 'Milk', 'Tapioca pearls', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '7a25c2f9-f2ee-4a59-a23d-f0ee24ebe033' and name = 'Ô long sữa';

update public.drinks set
  name_en = case when name_en = '' then 'Black Milk Tea' else name_en end,
  description_en = case when description_en = '' then 'Bold black tea with sweet, creamy milk and a smooth finish.' else description_en end,
  note_en = case when note_en = '' then 'Bold tea · Sweet & creamy · Smooth' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Black Milk Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Black tea', 'Milk', 'Tapioca pearls', 'Sugar', 'Ice']::text[] else ingredients_en end
where id = '04ebb356-7532-49a4-a4f4-626b957cb8a2' and name = 'Hồng trà sữa';

update public.drinks set
  name_en = case when name_en = '' then 'Mango Macchiato Tea' else name_en end,
  description_en = case when description_en = '' then 'Sweet-tart mango tea topped with silky macchiato cream.' else description_en end,
  note_en = case when note_en = '' then 'Mango · Sweet-tart · Silky' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Mango Macchiato Tea' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tea', 'Mango', 'Macchiato cream', 'Ice']::text[] else ingredients_en end
where id = 'a466a9d2-2e9c-47d6-8929-e4609b589b24' and name = 'Trà xoài macchiato';

update public.drinks set
  name_en = case when name_en = '' then 'Blended Matcha' else name_en end,
  description_en = case when description_en = '' then 'Matcha blended with ice for a cool, smooth texture and a creamy green-tea flavour.' else description_en end,
  note_en = case when note_en = '' then 'Green tea · Cool & smooth · Creamy' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Blended Matcha' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Matcha powder', 'Fresh milk', 'Condensed milk', 'Whipping cream', 'Crushed ice']::text[] else ingredients_en end
where id = '4adbe7cf-af89-4034-a9bb-b8fd6d8db0e2' and name = 'Matcha đá xay';

update public.drinks set
  name_en = case when name_en = '' then 'Blended Cookies' else name_en end,
  description_en = case when description_en = '' then 'Sweet cookies blended with ice for a cool, creamy treat.' else description_en end,
  note_en = case when note_en = '' then 'Cookies · Sweet & creamy · Cool & smooth' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Blended Cookies' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Cookies', 'Fresh milk', 'Condensed milk', 'Whipping cream', 'Crushed ice']::text[] else ingredients_en end
where id = 'edf174a7-0d1f-4939-9ad0-6335809aa4f3' and name = 'Cookie đá xay';

update public.drinks set
  name_en = case when name_en = '' then 'Blended Chocolate' else name_en end,
  description_en = case when description_en = '' then 'Rich chocolate blended with ice for a smooth, creamy, cooling drink.' else description_en end,
  note_en = case when note_en = '' then 'Rich chocolate · Sweet & creamy · Cooling' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Blended Chocolate' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Chocolate', 'Fresh milk', 'Condensed milk', 'Whipping cream', 'Crushed ice']::text[] else ingredients_en end
where id = 'a4f7ded5-f1bc-470c-8cad-7dc838473e81' and name = 'Chocolate đá xay';

update public.drinks set
  name_en = case when name_en = '' then 'Blueberry Smoothie' else name_en end,
  description_en = case when description_en = '' then 'A smooth blueberry blend with gentle sweet-tart berry notes.' else description_en end,
  note_en = case when note_en = '' then 'Sweet-tart · Berries · Smooth' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Blueberry Smoothie' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Blueberry', 'Milk', 'Sugar', 'Crushed ice']::text[] else ingredients_en end
where id = '0b25f08f-deec-4532-8f31-dcbdb5b2942c' and name = 'Việt quất';

update public.drinks set
  name_en = case when name_en = '' then 'Mango & Passion Fruit Smoothie' else name_en end,
  description_en = case when description_en = '' then 'Sweet ripe mango and tangy passion fruit in a smooth tropical blend.' else description_en end,
  note_en = case when note_en = '' then 'Sweet mango · Tangy · Smooth' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Mango & Passion Fruit Smoothie' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Mango', 'Passion fruit', 'Milk', 'Sugar', 'Crushed ice']::text[] else ingredients_en end
where id = 'e002dfe2-4290-40de-95ee-c73ae838f04a' and name = 'Xoài - Chanh dây';

update public.drinks set
  name_en = case when name_en = '' then 'Raisin Roll' else name_en end,
  description_en = case when description_en = '' then 'A fragrant, sweet roll filled with raisins.' else description_en end,
  note_en = case when note_en = '' then 'Raisins · Gently sweet' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Raisin Roll' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Wheat flour', 'Butter', 'Raisins', 'Milk', 'Yeast', 'Sugar']::text[] else ingredients_en end
where id = '0b8cd18d-7f26-4845-bfd9-231169f98eb0' and name = 'Bánh cuộn nho';

update public.drinks set
  name_en = case when name_en = '' then 'Cinnamon Roll' else name_en end,
  description_en = case when description_en = '' then 'A soft roll with a fragrant cinnamon filling.' else description_en end,
  note_en = case when note_en = '' then 'Cinnamon · Gently sweet' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Cinnamon Roll' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Wheat flour', 'Butter', 'Cinnamon', 'Milk', 'Yeast', 'Sugar']::text[] else ingredients_en end
where id = '4afaa35c-2b6f-4fe8-b366-819676d385c8' and name = 'Bánh cuộn quế';

update public.drinks set
  name_en = case when name_en = '' then 'Brazilian Cheese Bread (6 pieces)' else name_en end,
  description_en = case when description_en = '' then 'A set of six chewy Brazilian cheese breads.' else description_en end,
  note_en = case when note_en = '' then 'Soft & chewy · Cheesy' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Brazilian Cheese Bread (6 pieces)' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tapioca starch', 'Cheese', 'Milk', 'Eggs', 'Cooking oil', 'Salt']::text[] else ingredients_en end
where id = '8742ed71-d4cc-4eb7-85d4-35d7a7c8094a' and name = 'Bánh phô mai dẻo (Set 6)';

update public.drinks set
  name_en = case when name_en = '' then 'Brazilian Cheese Bread (3 pieces)' else name_en end,
  description_en = case when description_en = '' then 'A set of three chewy Brazilian cheese breads.' else description_en end,
  note_en = case when note_en = '' then 'Soft & chewy · Cheesy' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Brazilian Cheese Bread (3 pieces)' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Tapioca starch', 'Cheese', 'Milk', 'Eggs', 'Cooking oil', 'Salt']::text[] else ingredients_en end
where id = 'b8ee3e7a-2121-4748-b067-c2caf4e7532a' and name = 'Bánh phô mai dẻo (Set 3)';

update public.drinks set
  name_en = case when name_en = '' then 'Cheesecake' else name_en end,
  description_en = case when description_en = '' then 'Smooth, creamy cheesecake with a gentle richness.' else description_en end,
  note_en = case when note_en = '' then 'Cheesy · Smooth' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Cheesecake' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Cream cheese', 'Eggs', 'Sugar', 'Whipping cream', 'Biscuits', 'Butter']::text[] else ingredients_en end
where id = 'b829df0b-3a0d-410f-96cf-f3102fc734f9' and name = 'Cheese Cake';

update public.drinks set
  name_en = case when name_en = '' then 'Double Chocolate' else name_en end,
  description_en = case when description_en = '' then 'A layered chocolate cake, rich and smooth.' else description_en end,
  note_en = case when note_en = '' then 'Rich chocolate · Sweet & creamy' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Double Chocolate' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Chocolate', 'Wheat flour', 'Eggs', 'Sugar', 'Butter', 'Whipping cream', 'Cocoa powder']::text[] else ingredients_en end
where id = 'bdc5c241-0747-4ad4-8dcd-f9d248c6fc29' and name = 'Double Chocolate';

update public.drinks set
  name_en = case when name_en = '' then 'Pecan Tart' else name_en end,
  description_en = case when description_en = '' then 'A buttery tart filled with pecans.' else description_en end,
  note_en = case when note_en = '' then 'Nutty · Sweet & fragrant' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Pecan Tart' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Wheat flour', 'Butter', 'Eggs', 'Sugar', 'Pecans']::text[] else ingredients_en end
where id = 'e36dec53-6d77-4fa7-92e8-e143a46a7917' and name = 'Tart Hồ Đào';

update public.drinks set
  name_en = case when name_en = '' then 'Tiramisu' else name_en end,
  description_en = case when description_en = '' then 'Layered tiramisu with coffee and cocoa aromas.' else description_en end,
  note_en = case when note_en = '' then 'Coffee · Silky' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Tiramisu' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Mascarpone', 'Ladyfinger biscuits', 'Coffee', 'Eggs', 'Sugar', 'Cocoa powder']::text[] else ingredients_en end
where id = '80644bae-e026-4cc1-b2fc-48372ef64a29' and name = 'Tiramisu';

update public.drinks set
  name_en = case when name_en = '' then 'Chocolate Mousse' else name_en end,
  description_en = case when description_en = '' then 'Soft, silky mousse with a rich chocolate flavour.' else description_en end,
  note_en = case when note_en = '' then 'Rich chocolate · Silky' else note_en end,
  image_alt_en = case when image_alt_en = '' then 'Chocolate Mousse' else image_alt_en end,
  ingredients_en = case when cardinality(ingredients_en) = 0 then ARRAY['Chocolate', 'Whipping cream', 'Milk', 'Sugar', 'Gelatin']::text[] else ingredients_en end
where id = 'e40e951c-303e-493e-a701-f04dc4d56c4e' and name = 'Choco Mousse';

notify pgrst, 'reload schema';
commit;

-- Verify the new fields after the transaction.
select count(*) as total, count(*) filter (where name_en <> '') as translated from public.drinks;
