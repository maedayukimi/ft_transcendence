import { Test, TestingModule } from '@nestjs/testing';
import { AuthControllerTsController } from './auth.controller.ts.controller';

describe('AuthControllerTsController', () => {
  let controller: AuthControllerTsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthControllerTsController],
    }).compile();

    controller = module.get<AuthControllerTsController>(AuthControllerTsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
